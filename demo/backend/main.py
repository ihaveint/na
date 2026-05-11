from __future__ import annotations
import json
import os
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional

import anthropic
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from malleable import semantic, generate_manifest
from models import Thread, SnoozeRequest, TagRequest, UISchema, GenerateSchemaRequest, GenerateComponentRequest, ChatRequest
from data import THREADS, THREADS_BY_ID

load_dotenv()

app = FastAPI(title="N/A Email Demo")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_anthropic: anthropic.Anthropic | None = None

def get_anthropic() -> anthropic.Anthropic:
    global _anthropic
    if _anthropic is None:
        _anthropic = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    return _anthropic

# ---------------------------------------------------------------------------
# Semantic endpoints — decorated so the SDK can introspect them
# ---------------------------------------------------------------------------

@semantic(entity="Thread", intent="list_all", description="All threads, newest first")
@app.get("/threads", response_model=list[Thread])
async def list_threads():
    return sorted(THREADS, key=lambda t: t.date, reverse=True)


@semantic(entity="Thread", intent="list_actionable", description="Unread or pending threads that need attention")
@app.get("/threads/actionable", response_model=list[Thread])
async def list_actionable_threads():
    return sorted(
        [t for t in THREADS if not t.is_read or t.due_date],
        key=lambda t: t.urgency_score,
        reverse=True,
    )


@semantic(entity="Thread", intent="get", description="Fetch a single thread by ID")
@app.get("/threads/{thread_id}", response_model=Thread)
async def get_thread(thread_id: str):
    thread = THREADS_BY_ID.get(thread_id)
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    return thread


@semantic(entity="Thread", operation="snooze", description="Snooze a thread until a given datetime")
@app.post("/threads/{thread_id}/snooze", response_model=Thread)
async def snooze_thread(thread_id: str, body: SnoozeRequest):
    thread = THREADS_BY_ID.get(thread_id)
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    thread.is_snoozed = True
    thread.due_date = body.until
    return thread


@semantic(entity="Thread", operation="tag_project", description="Assign a thread to a project")
@app.post("/threads/{thread_id}/tag", response_model=Thread)
async def tag_thread(thread_id: str, body: TagRequest):
    thread = THREADS_BY_ID.get(thread_id)
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    thread.project = body.project
    return thread


@semantic(entity="Thread", operation="mark_done", description="Mark a thread as read/done")
@app.post("/threads/{thread_id}/done", response_model=Thread)
async def mark_done(thread_id: str):
    thread = THREADS_BY_ID.get(thread_id)
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    thread.is_read = True
    return thread


# ---------------------------------------------------------------------------
# Manifest endpoint — served live so the frontend always has the latest
# ---------------------------------------------------------------------------

@app.get("/manifest")
async def get_manifest():
    from models import Thread as ThreadModel
    return generate_manifest([ThreadModel])


# ---------------------------------------------------------------------------
# Schema generation — AI agent translates natural language → UISchema
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = """You are a UI schema generation agent for a N/A email client.

Given:
1. A Semantic Manifest describing available data and operations
2. The user's current UI schema
3. A natural language request from the user

Output ONLY a valid JSON object matching this UISchema shape (no markdown, no explanation):
{
  "layout": "<list|kanban|calendar|table>",
  "data_source": "<list_all|list_actionable>",
  "group_by": "<field_name or null>",
  "sort_by": "<field_name or null>",
  "sort_direction": "<asc|desc>",
  "card_fields": ["<field_names>"],
  "filters": [{"field": "...", "op": "<eq|neq|gt|lt>", "value": "..."}],
  "actions": ["<MarkDone|SnoozeThread|TagProject>"]
}

Available fields on Thread: id, subject, sender, sender_name, preview, project, urgency_score, date, is_read, is_snoozed, due_date, tags
Virtual group_by fields (computed, not stored): urgency_bucket (Critical/Normal/Low based on urgency_score), has_deadline (Has deadline/No deadline based on due_date)
Available layouts: list, kanban, calendar, table
Rules:
- calendar layout requires group_by=null, sort_by="date" or "due_date"
- kanban layout works best with group_by="project" or group_by="urgency_bucket"
- Always include at least ["subject", "sender_name"] in card_fields
"""


@app.post("/generate-schema", response_model=UISchema)
async def generate_schema(body: GenerateSchemaRequest):
    manifest = generate_manifest()

    response = get_anthropic().messages.create(
        model="claude-sonnet-4-6",
        max_tokens=512,
        system=_SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": (
                    f"Semantic Manifest:\n{json.dumps(manifest, indent=2)}\n\n"
                    f"Current schema:\n{body.current_schema.model_dump_json(indent=2)}\n\n"
                    f"User request: {body.user_message}"
                ),
            }
        ],
    )

    raw = response.content[0].text.strip()
    try:
        parsed = json.loads(raw)
        return UISchema(**parsed)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Schema parse error: {e}\nRaw: {raw}")


# ---------------------------------------------------------------------------
# Component generation — AI agent writes a React component from scratch
# ---------------------------------------------------------------------------

_COMPONENT_SYSTEM_PROMPT = """You are a conversational UI generation agent for a N/A email client.

Your job is to have a conversation with the user to understand what layout they want, ask clarifying questions when needed, and then generate a React component.

RESPONSE FORMAT — always respond with valid JSON, no markdown fences:
  {"action": "question", "message": "...", "code": null}
  {"action": "component", "message": "...", "code": "function Layout({ threads }) { ... }"}

When to use "question":
- The layout type is vague ("show it differently", "make it nicer")
- Key parameters are unspecified for the requested layout type:
    heatmap → need to know both axes
    timeline → need to know sort field and what to display per entry
    split-pane → need to know what goes in each pane
    activity grid → need to know the metric and time dimension
- Ask ONE focused question at a time. Be concise and friendly.

When to use "component":
- You have enough information to build exactly what the user wants
- The user is making a specific modification to an existing component (current_code is provided)
- The layout type and its key parameters are clear from the conversation

When generating, "message" should be a single short sentence describing what you built.

--- COMPONENT RULES ---

The component receives one prop:
  threads: Thread[]

Each Thread has:
  id, subject, sender, sender_name, preview, project (string|null),
  urgency_score (0–100), date (ISO string), is_read (bool),
  is_snoozed (bool), due_date (ISO string|null), tags (string[])

Already in scope — do NOT import:
  React, useState, useEffect, useMemo
  formatDate(iso) → string  (e.g. "Today", "Jan 5")
  urgencyColor(score) → string  (Tailwind classes, e.g. "bg-red-100 text-red-700 border-red-200")
  groupThreads(threads, field) → Record<string, Thread[]>

Styling — CRITICAL:
- Use inline style={{}} for ALL layout properties: display, gridTemplateColumns, flex, width, height, gridTemplateRows, etc.
- Tailwind is safe for: colors (bg-*, text-*, border-*), spacing (p-*, m-*, gap-*), typography, borders, overflow.
- Always add p-4 or similar at the root so content is not flush against the edge.
- The component renders inside a full-width full-height flex-1 overflow-auto container.

Layout guidance:
- Heatmap: grid via inline style, rows = one dimension, columns = another, cells bg-colored by count/intensity
- Timeline: vertical axis on the left, dated entries with connecting line
- Split-pane: two side-by-side divs via inline style, useState for selected item
- Swimlane: horizontal rows via inline style, one per group, cards inside
- Activity grid: GitHub-style squares via inline style, colored by metric

Component format:
- Named exactly `Layout`
- Starts with: function Layout({ threads }) {
- Ends with the closing: }
- No imports, no exports
"""


@app.post("/generate-component")
async def generate_component(body: GenerateComponentRequest):
    messages = [{"role": m.role, "content": m.content} for m in body.messages]

    # Prepend current code context to the first user message if we have it
    if body.current_code and messages:
        messages = [
            {
                "role": "user",
                "content": (
                    f"[Current component code for reference]\n```jsx\n{body.current_code}\n```\n\n"
                    f"{messages[0]['content']}"
                ),
            }
        ] + messages[1:]

    response = get_anthropic().messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        system=_COMPONENT_SYSTEM_PROMPT,
        messages=messages,
    )

    raw = response.content[0].text.strip()
    # Strip markdown fences if Claude wrapped the JSON
    if raw.startswith("```"):
        raw = "\n".join(raw.split("\n")[1:])
    if raw.endswith("```"):
        raw = "\n".join(raw.split("\n")[:-1])

    try:
        parsed = json.loads(raw.strip())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"JSON parse error: {e}\nRaw: {raw}")

    return {
        "action": parsed.get("action", "component"),
        "message": parsed.get("message", ""),
        "code": parsed.get("code"),
    }


# ---------------------------------------------------------------------------
# Unified chat — single endpoint that decides schema vs component vs question
# ---------------------------------------------------------------------------

_CHAT_SYSTEM_PROMPT = """You are a conversational UI agent for a N/A email client. You help users customize how their email data is displayed by either updating a config schema or generating a custom React component.

ALWAYS respond with valid JSON only — no markdown fences, no explanation outside the JSON:

Schema update:    {"action":"schema",    "message":"...", "schema":{...}, "code":null}
Component:        {"action":"component", "message":"...", "schema":null,  "code":"function Layout({ threads }) { ... }"}
Clarifying question: {"action":"question",  "message":"...", "schema":null,  "code":null}

--- WHEN TO USE EACH ---

Use "schema" when the user wants:
- A standard layout: list, kanban, table, calendar
- Sorting, filtering, or grouping by a field
- Changing visible fields or data source
- Simple, well-defined presentation changes

Use "component" when the user wants:
- A layout not in the schema: heatmap, timeline, split-pane, activity grid, swimlane, or any novel visual
- The current_code is already provided — ALWAYS use "component" to modify it, never revert to schema
- Significant custom visual structure

CRITICAL — when current_code is provided:
- Make ONLY the minimal change the user asked for. Do not redesign, reformat, or restyle anything else.
- Copy the existing code exactly and add/change only what is explicitly requested.
- Preserve all existing variable names, structure, styling, and logic that was not mentioned.
- If the user asked for a tooltip on one column, add only that tooltip. Do not change colors, fonts, layout, other columns, or any other part of the component.

Use "question" when:
- The request is too vague to act on ("make it better", "change it")
- Key parameters are missing for the requested layout
- Ask ONE focused question

--- SCHEMA FORMAT ---

UISchema:
{
  "layout": "list" | "kanban" | "table" | "calendar",
  "data_source": "list_all" | "list_actionable",
  "group_by": "<field>" | null,
  "sort_by": "<field>" | null,
  "sort_direction": "asc" | "desc",
  "card_fields": ["subject", "sender_name", ...],
  "filters": [{"field":"...","op":"eq|neq|gt|lt","value":"..."}],
  "actions": ["MarkDone","SnoozeThread","TagProject"]
}

Thread fields: id, subject, sender, sender_name, preview, project, urgency_score (0-100), date (ISO), is_read, is_snoozed, due_date (ISO|null), tags (string[])
Virtual group_by: urgency_bucket (Critical/Normal/Low), has_deadline (Has deadline/No deadline)
Calendar requires sort_by="date" or "due_date". Kanban works best with group_by set.
Always include at least ["subject","sender_name"] in card_fields.

--- COMPONENT FORMAT ---

Props: { threads: Thread[] }  (same fields as above)
Already in scope — do NOT import: React, useState, useEffect, useMemo, formatDate(iso), urgencyColor(score), groupThreads(threads, field)

CRITICAL styling: use inline style={{}} for ALL layout properties (display, gridTemplateColumns, flex, width, height).
Tailwind is safe only for: colors (bg-*, text-*, border-*), spacing (p-*, m-*, gap-*), typography, borders.
Always add p-4 at the root. Renders inside a full-width full-height overflow-auto container.

Component must be named exactly `Layout`, no imports, no exports.
"""


def _make_modify_prompt(current_code: str) -> str:
    return f"""You are a surgical code editor. Your only job is to apply the smallest possible change to an existing React component.

THE EXISTING COMPONENT (do not change anything not explicitly requested):
```jsx
{current_code}
```

RULES — read carefully:
1. Copy the component above exactly, character for character.
2. Apply ONLY the specific change the user requests. Nothing else.
3. Do not rename variables, reformat code, change styling, restructure logic, or alter any line that is not directly involved in the requested change.
4. If the change requires hover state, use useState (already in scope). Example pattern for a tooltip:
   const [hovered, setHovered] = useState(null)
   ...onMouseEnter={{() => setHovered(id)}} onMouseLeave={{() => setHovered(null)}}
   {{hovered === id && <div style={{position:'absolute', ...}}>tooltip content</div>}}
5. For absolutely-positioned tooltips, the parent element needs style={{position:'relative'}}.

Respond with valid JSON only (no markdown):
{{"action":"component","message":"one sentence describing only what changed","code":"function Layout({{ threads }}) {{ ... }}"}}

If the request is too vague to act on, respond:
{{"action":"question","message":"your clarifying question","code":null}}
"""


@app.post("/chat")
async def chat(body: ChatRequest):
    messages = [{"role": m.role, "content": m.content} for m in body.messages]

    if body.current_code:
        # Modification path: dedicated surgical-edit prompt with code baked into system prompt
        system = _make_modify_prompt(body.current_code)
        # No extra context prepended — the code is already in the system prompt
    else:
        # Generation path: full chat prompt with schema context
        system = _CHAT_SYSTEM_PROMPT
        context = f"Current schema:\n{body.current_schema.model_dump_json(indent=2)}"
        if messages:
            messages = [
                {"role": "user", "content": context + "\n\n" + messages[0]["content"]}
            ] + messages[1:]

    response = get_anthropic().messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        system=system,
        messages=messages,
    )

    raw = response.content[0].text.strip()
    # Strip markdown fences
    if raw.startswith("```"):
        raw = "\n".join(raw.split("\n")[1:])
    if raw.endswith("```"):
        raw = "\n".join(raw.split("\n")[:-1])
    # Find the JSON object even if Claude prepended explanatory text
    start = raw.find("{")
    if start > 0:
        raw = raw[start:]

    try:
        parsed = json.loads(raw.strip())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"JSON parse error: {e}\nRaw: {raw}")

    result: dict = {
        "action": parsed.get("action", "question"),
        "message": parsed.get("message", ""),
        "schema": None,
        "code": parsed.get("code"),
    }

    if parsed.get("action") == "schema" and parsed.get("schema"):
        try:
            result["schema"] = UISchema(**parsed["schema"]).model_dump()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Schema parse error: {e}")

    return result
