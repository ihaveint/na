from __future__ import annotations
from datetime import datetime

from fastapi import APIRouter, HTTPException

from malleable import semantic
from malleable_server import create_malleable_app, MalleableConfig, BaseComponentGenerator

from models import Thread, SnoozeRequest, TagRequest, UISchema, ChatRequest, ShareArtifact
from data import THREADS, THREADS_BY_ID

# ---------------------------------------------------------------------------
# CRUD routes (on a sub-router so the factory can attach them)
# ---------------------------------------------------------------------------

crud = APIRouter()

@semantic(entity="Thread", intent="list_all", description="All threads, newest first", path="/threads")
@crud.get("/threads", response_model=list[Thread])
async def list_threads():
    return sorted(THREADS, key=lambda t: t.date, reverse=True)


@semantic(entity="Thread", intent="list_actionable", description="Unread or pending threads that need attention", path="/threads/actionable")
@crud.get("/threads/actionable", response_model=list[Thread])
async def list_actionable_threads():
    return sorted(
        [t for t in THREADS if not t.is_read or t.due_date],
        key=lambda t: t.urgency_score,
        reverse=True,
    )


@semantic(entity="Thread", intent="get", description="Fetch a single thread by ID")
@crud.get("/threads/{thread_id}", response_model=Thread)
async def get_thread(thread_id: str):
    thread = THREADS_BY_ID.get(thread_id)
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    return thread


@semantic(entity="Thread", operation="snooze", description="Snooze a thread until a given datetime")
@crud.post("/threads/{thread_id}/snooze", response_model=Thread)
async def snooze_thread(thread_id: str, body: SnoozeRequest):
    thread = THREADS_BY_ID.get(thread_id)
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    thread.is_snoozed = True
    thread.due_date = body.until
    return thread


@semantic(entity="Thread", operation="tag_project", description="Assign a thread to a project")
@crud.post("/threads/{thread_id}/tag", response_model=Thread)
async def tag_thread(thread_id: str, body: TagRequest):
    thread = THREADS_BY_ID.get(thread_id)
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    thread.project = body.project
    return thread


@semantic(entity="Thread", operation="mark_done", description="Mark a thread as read/done")
@crud.post("/threads/{thread_id}/done", response_model=Thread)
async def mark_done(thread_id: str):
    thread = THREADS_BY_ID.get(thread_id)
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    thread.is_read = True
    return thread

# ---------------------------------------------------------------------------
# Domain-specific field helpers for base component generation
# ---------------------------------------------------------------------------

_FIELD_LABELS: dict[str, str] = {
    "id": "ID",
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

def field_label(field: str) -> str:
    return _FIELD_LABELS.get(field, field.replace("_", " ").title())


def cell_jsx(field: str) -> str:
    if field in ("date", "due_date", "created_at", "updated_at") or "date" in field or field.endswith("_at"):
        return f'<span className="text-zinc-500">{{formatDate(item.{field})}}</span>'
    if field == "is_read":
        return '<span className={item.is_read ? "text-zinc-400" : "text-blue-600 font-medium"}>{item.is_read ? "Read" : "Unread"}</span>'
    return (
        f'{{Array.isArray(item.{field})'
        f' ? <div className="flex gap-1 flex-wrap">{{(item.{field}).map(v => <span key={{v}} className="bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded text-xs">{{v}}</span>)}}</div>'
        f' : <span className="text-zinc-700 truncate block max-w-xs">{{String(item.{field} ?? "\u2014")}}</span>}}'
    )


email_generator = BaseComponentGenerator(field_label=field_label, cell_jsx=cell_jsx)


def build_system_prompt(manifest: dict) -> str:
    """Build the /chat system prompt dynamically from the manifest."""
    from malleable_server import build_chat_system_prompt
    return build_chat_system_prompt(manifest)

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = create_malleable_app(MalleableConfig(
    title="N/A Email Demo",
    cors_origins=["http://localhost:3000"],
    system_prompt=build_system_prompt,
    manifest_models=[Thread],
    chat_request_model=ChatRequest,
    ui_schema_model=UISchema,
    base_generator=email_generator,
    default_card_fields=["subject", "sender_name"],
    component_scope="N/A email client. Fields: id, subject, sender, sender_name, preview, project, urgency_score (0-100), date, is_read, is_snoozed, due_date, tags.",
))

app.include_router(crud)
