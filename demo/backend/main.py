from __future__ import annotations
import json
import os
import re
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional

import anthropic
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from malleable import semantic, generate_manifest
from models import Thread, SnoozeRequest, TagRequest, UISchema, GenerateSchemaRequest, GenerateComponentRequest, ChatRequest, ShareArtifact
from data import THREADS, THREADS_BY_ID

load_dotenv()

app = FastAPI(title="N/A Email Demo")
origins = os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
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
- Any feature the schema cannot express: tooltips, click interactions, custom cell rendering, conditional styling, hover effects
- A novel layout: heatmap, timeline, split-pane, activity grid, swimlane
- current_code is provided — ALWAYS use "component", never revert to schema

When current_code is NOT provided (schema mode) and you choose "component":
- Replicate the current schema layout visually: same layout type (table/list/kanban), same columns/fields, same sort order
- Then add the requested feature on top — do NOT invent a new visual style from scratch
- A table schema → generate a table component with the same columns. A list schema → generate a list component.

When current_code IS provided:
- Make ONLY the minimal change asked for. Do not redesign, reformat, or restyle anything else.
- Preserve all existing variable names, structure, styling, and logic not mentioned.

Use "question" when:
- The request is too vague ("make it better", "change it")
- Key parameters are missing
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

Props: { threads: Thread[], onThreadClick: (thread: Thread) => void }
Call onThreadClick(thread) when the user clicks a card/row/item to open its email detail view. Always wire this up on clickable items.
Already in scope — do NOT import: React, useState, useEffect, useMemo, formatDate(iso), urgencyColor(score), groupThreads(threads, field), today

today is a "YYYY-MM-DD" string in the user's local timezone. Use it for date comparisons (e.g. isDueToday = thread.due_date?.slice(0,10) === today). Never use new Date() comparisons across timezone boundaries.

urgencyColor(score) returns a STRING of Tailwind classes like "bg-red-100 text-red-700 border-red-200".
Use it ONLY in className, never in style. Example: <span className={urgencyColor(thread.urgency_score)}>

CRITICAL styling: use inline style={{}} for ALL layout properties (display, gridTemplateColumns, flex, width, height).
Tailwind is safe only for: colors (bg-*, text-*, border-*), spacing (p-*, m-*, gap-*), typography, borders.
BORDER RADIUS — always use inline style for rounded corners: style={{borderRadius:'1rem'}} NOT className="rounded-xl".
Tailwind rounded-* classes are unreliable in generated components because the CSS may not be pre-compiled.
Always add p-4 at the root. Renders inside a full-width full-height overflow-auto container.

TOOLTIPS — MANDATORY pattern (position:absolute is FORBIDDEN for tooltips — it gets clipped by overflow containers and breaks inside tables):
  const [tipPos, setTipPos] = useState(null)
  <trigger onMouseMove={e => setTipPos({x:e.clientX, y:e.clientY})} onMouseLeave={() => setTipPos(null)}>...</trigger>
  {tipPos && <div style={{position:'fixed',left:tipPos.x+12,top:tipPos.y-28,zIndex:9999,pointerEvents:'none'}} className="bg-zinc-800 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap">{content}</div>}

UNDEFINED REFERENCES — every function/component you call or render MUST be defined in the same output.
If you write <HeatmapModal />, a function HeatmapModal must exist in your code. No exceptions.

MANDATORY structure — you MUST decompose into at least 2 named functions:
- Extract every repeating or distinct UI element into its own function (e.g. ThreadCard, TableRow, GroupHeader, SidePanel)
- The main entry point MUST be named exactly `Layout`
- Add `data-sc="FunctionName"` on the ROOT element of EVERY function (including Layout) — this is required for surgical editing
- A single monolithic `function Layout` is NEVER acceptable
- No imports, no exports

Examples:
  List/table layouts → ThreadCard or TableRow + Layout (and TableHeader if there's a header row)
  Split-pane → ThreadListItem + DetailPanel + Layout
  Heatmap/grid → GridCell + GridRow + Layout

  function TableHeader() {
    return <thead data-sc="TableHeader"><tr>...</tr></thead>
  }
  function TableRow({ thread }) {
    return <tr data-sc="TableRow">...</tr>
  }
  function Layout({ threads }) {
    return <div data-sc="Layout" className="p-4">
      <table><TableHeader /><tbody>{threads.map(t => <TableRow key={t.id} thread={t} />)}</tbody></table>
    </div>
  }
"""


def _ensure_data_sc(code: str) -> str:
    """Inject data-sc="FunctionName" on the root JSX element of each top-level function that is missing it."""
    components = _parse_subcomponents(code)
    result = code
    for name, func_code in components.items():
        attr = f'data-sc="{name}"'
        if attr in func_code:
            continue
        # Find the first return statement that opens a JSX element
        m = re.search(r'return\s*\(?\s*<([A-Za-z][A-Za-z0-9.]*)', func_code)
        if not m:
            continue
        insert_at = m.end(1)
        new_func = func_code[:insert_at] + f' data-sc="{name}"' + func_code[insert_at:]
        result = result.replace(func_code, new_func, 1)
    return result


def _parse_subcomponents(code: str) -> dict[str, str]:
    """Extract top-level named function declarations from a React component string."""
    functions: dict[str, str] = {}
    lines = code.splitlines()
    i = 0
    while i < len(lines):
        m = re.match(r'^function (\w+)\s*\(', lines[i])
        if m:
            name = m.group(1)
            start = i
            depth = 0
            j = i
            while j < len(lines):
                depth += lines[j].count('{') - lines[j].count('}')
                j += 1
                if depth == 0 and j > start + 1:
                    functions[name] = '\n'.join(lines[start:j])
                    i = j
                    break
            else:
                i += 1
        else:
            i += 1
    return functions


def _replace_subcomponent(code: str, name: str, new_func: str) -> str:
    """Replace a named top-level function in the component code."""
    lines = code.splitlines()
    i = 0
    while i < len(lines):
        if re.match(r'^function ' + re.escape(name) + r'\s*\(', lines[i]):
            start = i
            depth = 0
            j = i
            while j < len(lines):
                depth += lines[j].count('{') - lines[j].count('}')
                j += 1
                if depth == 0 and j > start + 1:
                    return '\n'.join(lines[:start] + new_func.splitlines() + lines[j:])
            break
        i += 1
    return code


def _make_subcomponent_modify_prompt(components: dict[str, str], target: str | None, today: str | None = None) -> str:
    if target and target in components:
        component_section = f"Modify this sub-component:\n```jsx\n{components[target]}\n```"
        other_sections = "\n\n".join(
            f"[{name}] (context only — modify only if the change requires it)\n```jsx\n{func}\n```"
            for name, func in components.items() if name != target
        )
        if other_sections:
            component_section += f"\n\nOther sub-components for context:\n\n{other_sections}"
    else:
        sections = "\n\n".join(
            f"[{name}]\n```jsx\n{func}\n```" for name, func in components.items()
        )
        component_section = f"The current component has these sub-components:\n\n{sections}"

    tooltip_rule = (
        "- TOOLTIPS: ALWAYS use position:'fixed' and track mouse coords via onMouseMove — NEVER position:'absolute'."
        " Absolute positioning breaks inside tables and gets clipped by overflow containers."
        " Pattern: const [pos, setPos] = useState(null);"
        " attach onMouseMove={e => setPos({x:e.clientX,y:e.clientY})} onMouseLeave={() => setPos(null)} to the trigger;"
        " render {pos && <div style={{position:'fixed',left:pos.x+12,top:pos.y-28,zIndex:9999,pointerEvents:'none'}}"
        " className=\"bg-zinc-800 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap\">content</div>}"
    )
    return_instruction = (
        '{"action":"component","message":"one sentence","changes":[{"name":"ComponentName","code":"function ComponentName..."},...]}\n'
        'Include every sub-component you modified in "changes". Most edits touch 1-2; never return unchanged components.\n'
        'Or if ambiguous: {"action":"question","message":"your question"}'
    )
    today_line = f"Today's date: {today}\n\n" if today else ""
    return (
        "You are a surgical React component editor. Make the MINIMUM change needed.\n\n"
        + today_line
        + component_section
        + "\n\nRULES:\n"
        "- Preserve ALL existing logic, variable names, and styling not explicitly mentioned.\n"
        "- Keep the `data-sc=\"ComponentName\"` attribute on the root element of every function you return.\n"
        "- Do NOT redesign, reformat, or restyle anything not explicitly requested.\n"
        "- PROP DRILLING: If adding a new prop to a child component, you MUST also update every parent that renders it to pass that prop through. Include all affected components in your changes array.\n"
        "- Available in scope (do NOT import): React, useState, useEffect, useMemo, formatDate(iso), urgencyColor(score), groupThreads(threads, field), today\n"
        "- today is a \"YYYY-MM-DD\" string in the user's local timezone. Use it for due-date checks: thread.due_date?.slice(0,10) === today. Never construct new Date() and compare — timezone mismatch will break it.\n"
        "- Layout receives two props: `threads` (array) and `onThreadClick(thread)` (function). Call `onThreadClick(thread)` when the user clicks a thread/card/row to open its detail view. Always wire this up on clickable items.\n"
        + tooltip_rule + "\n"
        "- BORDER RADIUS: always use inline style={{borderRadius:'1rem'}} NOT Tailwind rounded-* classes. Tailwind rounded-* is unreliable in generated components.\n"
        "- UNDEFINED REFERENCES: every function/component you call or render MUST be defined in your output. If you reference <Foo />, Foo must appear as a function in the changes array. Never reference a function that isn't defined.\n"
        "- Return the COMPLETE modified function for each changed component, not snippets.\n\n"
        "Return ONLY valid JSON — no markdown fences, no text outside JSON:\n"
        + return_instruction
    )


_FIELD_LABELS: dict[str, str] = {
    "subject": "Subject",
    "sender": "Sender",
    "sender_name": "From",
    "preview": "Preview",
    "project": "Project",
    "urgency_score": "Priority",
    "date": "Date",
    "is_read": "Status",
    "is_snoozed": "Snoozed",
    "due_date": "Due",
    "tags": "Tags",
}


def _cell_jsx(field: str) -> str:
    """JSX for a table cell — matches CellValue in TableView.tsx exactly."""
    if field == "urgency_score":
        return '<span className={`px-1.5 py-0.5 rounded border text-xs ${urgencyColor(thread.urgency_score)}`}>{thread.urgency_score}</span>'
    if field == "date":
        return '<span className="text-zinc-500">{formatDate(thread.date)}</span>'
    if field == "due_date":
        return '<span className="text-zinc-500">{formatDate(thread.due_date)}</span>'
    if field == "is_read":
        return '<span className={thread.is_read ? "text-zinc-400" : "text-blue-600 font-medium"}>{thread.is_read ? "Read" : "Unread"}</span>'
    if field == "project":
        return '{thread.project ? <span className="bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded text-xs">{thread.project}</span> : <span className="text-zinc-400">—</span>}'
    if field == "tags":
        return '<div className="flex gap-1 flex-wrap">{(thread.tags || []).map(tag => <span key={tag} className="bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded text-xs">{tag}</span>)}</div>'
    if field == "subject":
        return '<span className={`truncate block max-w-xs ${!thread.is_read ? "font-semibold text-zinc-900" : "text-zinc-600"}`}>{thread.subject || "—"}</span>'
    return f'<span className="text-zinc-700 truncate block max-w-xs">{{String(thread.{field} ?? "—")}}</span>'


def _table_base_component(fields: list[str]) -> str:
    label_ths = "\n        ".join(
        f'<th className="text-left px-4 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wide">'
        f'{_FIELD_LABELS.get(f, f)}</th>'
        for f in fields
    )
    cell_tds = "\n      ".join(
        f'<td className="px-4 py-2 max-w-xs">{_cell_jsx(f)}</td>'
        for f in fields
    )
    return (
        'function TableHeader() {\n'
        '  return (\n'
        '    <thead data-sc="TableHeader">\n'
        '      <tr className="border-b border-zinc-200 bg-zinc-50">\n'
        f'        {label_ths}\n'
        '      </tr>\n'
        '    </thead>\n'
        '  )\n'
        '}\n'
        '\n'
        'function TableRow({ thread }) {\n'
        '  return (\n'
        '    <tr data-sc="TableRow" className={`hover:bg-zinc-50 transition-colors ${!thread.is_read ? "bg-blue-50/30" : ""}`}>\n'
        f'      {cell_tds}\n'
        '    </tr>\n'
        '  )\n'
        '}\n'
        '\n'
        'function Layout({ threads }) {\n'
        '  return (\n'
        '    <div data-sc="Layout" className="overflow-x-auto">\n'
        '      <table className="w-full text-sm">\n'
        '        <TableHeader />\n'
        '        <tbody className="divide-y divide-zinc-100">\n'
        '          {threads.map(t => <TableRow key={t.id} thread={t} />)}\n'
        '        </tbody>\n'
        '      </table>\n'
        '    </div>\n'
        '  )\n'
        '}'
    )


def _list_base_component(fields: list[str]) -> str:
    meta_parts: list[str] = []
    if "sender_name" in fields:
        meta_parts.append('          <span className="text-xs text-zinc-500">{thread.sender_name}</span>')
    if "project" in fields:
        meta_parts.append('          {thread.project && <span className="text-xs bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded">{thread.project}</span>}')
    if "due_date" in fields:
        meta_parts.append('          {thread.due_date && <span className="text-xs text-orange-600">Due {formatDate(thread.due_date)}</span>}')
    if "urgency_score" in fields:
        meta_parts.append('          <span className={`text-xs px-1.5 py-0.5 rounded border ${urgencyColor(thread.urgency_score)}`}>{thread.urgency_score}</span>')
    if "tags" in fields:
        meta_parts.append(
            '          {thread.tags && thread.tags.length > 0 && '
            '<div className="flex gap-1">'
            '{thread.tags.slice(0, 2).map(tag => '
            '<span key={tag} className="text-xs bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded">{tag}</span>'
            ')}</div>}'
        )
    meta_row = "\n".join(meta_parts)
    preview = (
        '\n        <p className="text-xs text-zinc-400 truncate mt-0.5">{thread.preview}</p>'
        if "preview" in fields else ""
    )
    return (
        'function ThreadCard({ thread }) {\n'
        '  return (\n'
        '    <div data-sc="ThreadCard" className={`flex gap-4 px-4 py-3 hover:bg-zinc-50 transition-colors ${!thread.is_read ? "bg-blue-50/40" : ""}`}>\n'
        '      <div className="mt-1 flex-shrink-0">\n'
        '        <div className={`w-2 h-2 rounded-full mt-1.5 ${!thread.is_read ? "bg-blue-500" : "bg-transparent"}`} />\n'
        '      </div>\n'
        '      <div className="flex-1 min-w-0">\n'
        '        <div className="flex items-baseline justify-between gap-2">\n'
        '          <span className={`text-sm truncate ${!thread.is_read ? "font-semibold text-zinc-900" : "text-zinc-700"}`}>\n'
        '            {thread.subject}\n'
        '          </span>\n'
        '          <span className="text-xs text-zinc-400 flex-shrink-0">{formatDate(thread.date)}</span>\n'
        '        </div>\n'
        '        <div className="flex items-center gap-2 mt-0.5">\n'
        f'{meta_row}\n'
        '        </div>'
        f'{preview}\n'
        '      </div>\n'
        '    </div>\n'
        '  )\n'
        '}\n'
        '\n'
        'function Layout({ threads }) {\n'
        '  return (\n'
        '    <div data-sc="Layout" className="flex flex-col divide-y divide-zinc-100">\n'
        '      {threads.map(t => <ThreadCard key={t.id} thread={t} />)}\n'
        '    </div>\n'
        '  )\n'
        '}'
    )


def _schema_to_base_component(schema) -> str | None:
    """Deterministically generate a JSX component that exactly matches schema-rendered output."""
    fields = schema.card_fields or ["subject", "sender_name"]
    if schema.layout == "table":
        return _table_base_component(fields)
    if schema.layout == "list":
        return _list_base_component(fields)
    return None


# ---------------------------------------------------------------------------
# Share store (in-memory; survives server restarts via simple dict)
# ---------------------------------------------------------------------------

import secrets
_share_store: dict[str, dict] = {}

@app.post("/share")
def create_share(artifact: ShareArtifact):
    share_id = secrets.token_urlsafe(8)
    _share_store[share_id] = artifact.model_dump()
    return {"id": share_id}

@app.get("/share/{share_id}")
def get_share(share_id: str):
    artifact = _share_store.get(share_id)
    if not artifact:
        raise HTTPException(status_code=404, detail="Share not found")
    return artifact


def _is_bug_report(message: str) -> bool:
    """Use a fast LLM call to decide if the message is reporting broken behavior vs. requesting a new feature."""
    resp = get_anthropic().messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=8,
        system=(
            "Reply with only 'yes' or 'no'. "
            "Is the following message reporting that something is broken, not working, or producing wrong output? "
            "(yes = bug report / debugging; no = new feature request or styling change)"
        ),
        messages=[{"role": "user", "content": message}],
    )
    return resp.content[0].text.strip().lower().startswith("y")


def _find_undefined_components(code: str) -> list[str]:
    """Return any JSX component names that are used but not defined in the code."""
    defined = set(re.findall(r'function\s+([A-Z]\w*)\s*\(', code))
    used = set(re.findall(r'<([A-Z]\w*)[\s/>]', code))
    # These are always available in scope
    builtin = {"React"}
    return sorted(used - defined - builtin)


def _parse_response(raw: str) -> dict:
    if raw.startswith("```"):
        raw = "\n".join(raw.split("\n")[1:])
    if raw.endswith("```"):
        raw = "\n".join(raw.split("\n")[:-1])
    start = raw.find("{")
    if start > 0:
        raw = raw[start:]
    try:
        return json.loads(raw.strip())
    except json.JSONDecodeError:
        # AI returned plain text (e.g. a clarifying question) instead of JSON
        if raw.strip():
            return {"action": "question", "message": raw.strip()}
        raise


@app.post("/chat")
async def chat(body: ChatRequest):
    today = datetime.now().strftime("%Y-%m-%d")
    chat_system_prompt = f"Today's date: {today}\n\n{_CHAT_SYSTEM_PROMPT}"
    messages = [{"role": m.role, "content": m.content} for m in body.messages]

    if body.current_code:
        # Decomposition path: parse sub-components, modify only the relevant one
        components = _parse_subcomponents(body.current_code)

        # Legacy monolithic component (no sub-components) — can't surgically edit it
        if len(components) <= 1:
            return {
                "action": "question",
                "message": "This component was generated without sub-components, so I can't make surgical edits. Ask me to regenerate the layout from scratch with your changes included.",
                "schema": None,
                "code": None,
            }

        # Structural components (layout skeleton only) — not useful as a surgical target;
        # treat as no-target so Claude sees all sub-components and picks the right one.
        _STRUCTURAL = {"TableHeader", "Layout"}

        # Extract [SubcomponentName] from the last user message if present (from inspect context)
        last_message = messages[-1]["content"] if messages else ""

        # Bug reports need full component visibility — the cause may be in any sub-component
        # or in the data flow between them, so skip surgical targeting entirely.
        if _is_bug_report(last_message):
            target = None
        else:
            target_match = re.search(r'\[(\w+)\]', last_message)
            target = target_match.group(1) if target_match else None
            if target and (target not in components or target in _STRUCTURAL):
                target = None

            # No inspect context — check recent history for the last useful target
            if not target:
                for msg in reversed(messages[:-1]):
                    m = re.search(r'\[(\w+)\]', msg.get("content", ""))
                    if m and m.group(1) in components and m.group(1) not in _STRUCTURAL:
                        target = m.group(1)
                        break

        raw = get_anthropic().messages.create(
            model="claude-sonnet-4-6",
            max_tokens=8096,
            system=_make_subcomponent_modify_prompt(components, target, today),
            messages=messages,
        ).content[0].text.strip()

        try:
            parsed = _parse_response(raw)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"JSON parse error: {e}\nRaw: {raw}")

        if parsed.get("action") == "component":
            changes = parsed.get("changes", [])
            # Support legacy single-component format too
            if not changes and parsed.get("name") and parsed.get("code"):
                changes = [{"name": parsed["name"], "code": parsed["code"]}]
            updates = [(c["name"], c["code"]) for c in changes if c.get("name") in components and c.get("code")]
            additions = [(c["name"], c["code"]) for c in changes if c.get("name") not in components and c.get("code")]
            valid = updates or additions
            if valid:
                result_code = body.current_code
                for func_name, new_func in updates:
                    result_code = _replace_subcomponent(result_code, func_name, new_func)
                # Append brand-new components before Layout so they're available when referenced
                if additions:
                    new_defs = "\n\n".join(code for _, code in additions)
                    layout_match = re.search(r'\nfunction Layout\b', result_code)
                    if layout_match:
                        result_code = result_code[:layout_match.start()] + "\n\n" + new_defs + result_code[layout_match.start():]
                    else:
                        result_code = new_defs + "\n\n" + result_code
                undefined = _find_undefined_components(result_code)
                if undefined:
                    fix_msg = (
                        f"Your previous response referenced {', '.join(undefined)} but never defined {'it' if len(undefined) == 1 else 'them'}. "
                        f"Return the same changes but include the complete function definition for every component you reference. "
                        f"Do not omit any component."
                    )
                    raw2 = get_anthropic().messages.create(
                        model="claude-sonnet-4-6",
                        max_tokens=8096,
                        system=_make_subcomponent_modify_prompt(components, target, today),
                        messages=messages + [{"role": "assistant", "content": raw}, {"role": "user", "content": fix_msg}],
                    ).content[0].text.strip()
                    try:
                        parsed2 = _parse_response(raw2)
                    except Exception:
                        parsed2 = {}
                    if parsed2.get("action") == "component":
                        changes2 = parsed2.get("changes", [])
                        valid2 = [(c["name"], c["code"]) for c in changes2 if c.get("name") in components and c.get("code")]
                        if valid2:
                            result_code = body.current_code
                            for func_name, new_func in valid2:
                                result_code = _replace_subcomponent(result_code, func_name, new_func)
                            if not _find_undefined_components(result_code):
                                return {"action": "component", "message": parsed2.get("message", parsed["message"]), "schema": None, "code": _ensure_data_sc(result_code)}
                    return {
                        "action": "question",
                        "message": f"The generated code references {', '.join(undefined)} but never defines {'it' if len(undefined) == 1 else 'them'}. Please try again.",
                        "schema": None,
                        "code": None,
                    }
                return {"action": "component", "message": parsed["message"], "schema": None, "code": _ensure_data_sc(result_code)}
            return {
                "action": "question",
                "message": "I couldn't match the change to the right sub-component. Click Inspect, select the exact element, and try again.",
                "schema": None,
                "code": None,
            }
        elif parsed.get("action") == "question":
            return {"action": "question", "message": parsed["message"], "schema": None, "code": None}

        return {
            "action": "question",
            "message": "I wasn't sure how to apply that change safely. Use Inspect to select the exact element you'd like to modify.",
            "schema": None,
            "code": None,
        }

    else:
        # Generation path — give Claude a deterministic base if the layout is table or list
        base = _schema_to_base_component(body.current_schema)
        if base:
            context = (
                f"Current schema:\n{body.current_schema.model_dump_json(indent=2)}\n\n"
                f"The following base component already matches the current layout pixel-for-pixel. "
                f"Start from it — do NOT redesign or restyle it. Add ONLY what the user asks for, nothing more:\n"
                f"```jsx\n{base}\n```"
            )
        else:
            context = (
                f"Current schema (the user's active layout — if you generate a component, "
                f"visually replicate this layout first then layer in the requested change):\n"
                f"{body.current_schema.model_dump_json(indent=2)}"
            )
        if messages:
            messages = [{"role": "user", "content": context + "\n\n" + messages[0]["content"]}] + messages[1:]

    raw = get_anthropic().messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        system=chat_system_prompt,
        messages=messages,
    ).content[0].text.strip()

    try:
        parsed = _parse_response(raw)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"JSON parse error: {e}\nRaw: {raw}")

    raw_code = parsed.get("code")
    if raw_code:
        undefined = _find_undefined_components(raw_code)
        if undefined:
            fix_msg = (
                f"Your previous response referenced {', '.join(undefined)} but never defined {'it' if len(undefined) == 1 else 'them'}. "
                f"Regenerate the full component and include the complete function definition for every component you reference."
            )
            raw2 = get_anthropic().messages.create(
                model="claude-sonnet-4-6",
                max_tokens=8096,
                system=chat_system_prompt,
                messages=messages + [{"role": "assistant", "content": raw}, {"role": "user", "content": fix_msg}],
            ).content[0].text.strip()
            try:
                parsed = _parse_response(raw2)
                raw_code = parsed.get("code")
            except Exception:
                pass
    result: dict = {
        "action": parsed.get("action", "question"),
        "message": parsed.get("message", ""),
        "schema": None,
        "code": _ensure_data_sc(raw_code) if raw_code else None,
    }

    if parsed.get("action") == "schema" and parsed.get("schema"):
        try:
            result["schema"] = UISchema(**parsed["schema"]).model_dump()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Schema parse error: {e}")

    return result
