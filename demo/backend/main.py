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
from models import Thread, SnoozeRequest, TagRequest, UISchema, GenerateSchemaRequest
from data import THREADS, THREADS_BY_ID

load_dotenv()

app = FastAPI(title="Malleable Email Demo")
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

_SYSTEM_PROMPT = """You are a UI schema generation agent for a malleable email client.

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
