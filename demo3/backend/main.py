from __future__ import annotations
import os
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import APIRouter

from malleable import semantic
from malleable_server import create_malleable_app, MalleableConfig, BaseComponentGenerator

from models import UISchema, ChatRequest, ShareArtifact
from data import PLAYLISTS, TRACKS

load_dotenv(Path(__file__).resolve().parent / ".env")

# ---------------------------------------------------------------------------
# CRUD routes
# ---------------------------------------------------------------------------

crud = APIRouter()


@semantic(entity="Track", intent="list_tracks", path="/tracks", description="All tracks, optionally filtered by playlist_id")
@crud.get("/tracks")
async def list_tracks(playlist_id: Optional[str] = None):
    if playlist_id:
        return [t for t in TRACKS if t["playlist_id"] == playlist_id]
    return TRACKS


@crud.get("/playlists")
async def list_playlists():
    return PLAYLISTS

# ---------------------------------------------------------------------------
# Domain-specific field helpers
# ---------------------------------------------------------------------------

_FIELD_LABELS: dict[str, str] = {
    "id": "ID",
    "title": "Title",
    "artist": "Artist",
    "album": "Album",
    "genre": "Genre",
    "duration_sec": "Duration",
    "bpm": "BPM",
    "playlist_id": "Playlist",
    "audio_url": "Audio URL",
}

def field_label(field: str) -> str:
    return _FIELD_LABELS.get(field, field.replace("_", " ").title())


def cell_jsx(field: str) -> str:
    if field == "duration_sec":
        return '{formatDuration(item.duration_sec)}'
    if field == "bpm":
        return '<span className="text-zinc-600 font-mono text-xs">{item.bpm} BPM</span>'
    if field in ("date", "due_date", "created_at", "updated_at") or "date" in field or field.endswith("_at"):
        return f'<span className="text-zinc-500">{{formatDate(item.{field})}}</span>'
    return (
        f'{{Array.isArray(item.{field})'
        f' ? <div className="flex gap-1 flex-wrap">{{(item.{field}).map(v => <span key={{v}} className="bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded text-xs">{{v}}</span>)}}</div>'
        f' : <span className="text-zinc-700 truncate block max-w-xs">{{String(item.{field} ?? "\u2014")}}</span>}}'
    )


def _meta_pills_jsx(fields: list[str], indent: str = "          ") -> str:
    meta_fields = [f for f in fields if f not in {"subject", "title", "name", "id"}]
    parts: list[str] = []
    for field in meta_fields:
        if field == "duration_sec":
            parts.append(f'{indent}<span className="text-xs text-zinc-400 font-mono">{{formatDuration(item.duration_sec)}}</span>')
        elif field == "bpm":
            parts.append(f'{indent}{{item.bpm != null && <span className="text-xs bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded font-mono">{{item.bpm}} BPM</span>}}')
        elif field in ("date", "due_date", "created_at", "updated_at") or "date" in field or field.endswith("_at"):
            parts.append(f'{indent}{{item.{field} && <span className="text-xs text-zinc-400">{{formatDate(item.{field})}}</span>}}')
        else:
            parts.append(
                f'{indent}{{item.{field} != null && item.{field} !== false && ('
                f'Array.isArray(item.{field})'
                f' ? (item.{field}).slice(0,3).map(v => <span key={{v}} className="text-xs bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded">{{v}}</span>)'
                f' : <span className="text-xs bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded">{{String(item.{field})}}</span>'
                f')}}'
            )
    return "\n".join(parts)


def _kanban_base_component(fields: list[str], group_by: str | None) -> str:
    group_expr = f"'{group_by}'" if group_by else "'title'"
    meta_row = _meta_pills_jsx(fields, indent="        ")
    return (
        'function KanbanCard({ item, onItemClick }) {\n'
        '  const title = item.title ?? item.name ?? item.subject ?? "(untitled)"\n'
        '  const isActive = item.id === currentTrackId\n'
        '  return (\n'
        '    <div data-sc="KanbanCard"\n'
        '      onClick={() => onItemClick && onItemClick(item)}\n'
        '      style={{borderRadius:"0.75rem", borderLeft: isActive ? "3px solid #10b981" : "3px solid transparent"}}\n'
        '      className={`p-3 bg-white border border-zinc-200 hover:border-zinc-300 transition-colors cursor-pointer shadow-sm ${isActive ? "bg-emerald-50" : ""}`}>\n'
        '      <div className="flex items-baseline gap-1 mb-1">\n'
        '        {isActive && <span className="text-emerald-500 text-xs">\u25b6</span>}\n'
        '        <span className={`text-sm font-medium truncate ${isActive ? "text-emerald-700" : "text-zinc-800"}`}>{String(title)}</span>\n'
        '      </div>\n'
        '      <div className="flex flex-wrap gap-1 mt-1">\n'
        f'{meta_row}\n'
        '      </div>\n'
        '    </div>\n'
        '  )\n'
        '}\n'
        '\n'
        'function KanbanColumn({ group, colItems, onItemClick }) {\n'
        '  return (\n'
        '    <div data-sc="KanbanColumn" className="flex flex-col gap-2 flex-shrink-0 w-56">\n'
        '      <div className="flex items-center justify-between px-1 py-1 border-b border-zinc-200 mb-1">\n'
        '        <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">{group || "Other"}</span>\n'
        '        <span className="text-xs text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded-full">{colItems.length}</span>\n'
        '      </div>\n'
        '      {colItems.map(item => <KanbanCard key={item.id ?? item.title} item={item} onItemClick={onItemClick} />)}\n'
        '    </div>\n'
        '  )\n'
        '}\n'
        '\n'
        'function Layout({ items, onItemClick }) {\n'
        f'  const groups = groupItems(items, {group_expr})\n'
        '  return (\n'
        '    <div data-sc="Layout" style={{display:"flex",gap:"1rem",overflowX:"auto",alignItems:"flex-start"}} className="p-4">\n'
        '      {Object.entries(groups).map(([group, colItems]) => (\n'
        '        <KanbanColumn key={group} group={group} colItems={colItems} onItemClick={onItemClick} />\n'
        '      ))}\n'
        '    </div>\n'
        '  )\n'
        '}'
    )


def _groove_schema_to_base(generator: BaseComponentGenerator, schema, default_fields: list[str] | None = None) -> str:
    fields = schema.card_fields or default_fields or ["title", "artist", "duration_sec"]
    if schema.layout == "table":
        return generator.table_base_component(fields)
    if schema.layout == "kanban":
        return _kanban_base_component(fields, schema.group_by)
    return generator.list_base_component(fields)


groove_generator = BaseComponentGenerator(
    field_label=field_label,
    cell_jsx=cell_jsx,
    schema_to_base_component_override=_groove_schema_to_base,
)


_SYSTEM_PROMPT = """You are a conversational UI agent for Groove, a music player.
You help users customize how their track list is displayed by updating a config schema or generating a custom React component.

Each item is a Track with fields:
- id: string
- title: string (primary label)
- artist: string
- album: string
- genre: string[] (render as chips)
- duration_sec: number (ALWAYS use formatDuration)
- bpm: number
- audio_url: string (NEVER render as visible text)
- playlist_id: string

Virtual groupBy: bpm_bucket -> "Low" (<90 BPM), "Mid" (90-120), "High" (>120)

Component scope: items, onItemClick(item), currentTrackId, groupItems(items, field), formatDuration(sec), formatDate
ALWAYS wire click handlers to onItemClick(item)
ALWAYS highlight the track where item.id === currentTrackId (green text, play icon, bold title, green left border)
NEVER render audio_url as visible text
ALWAYS use formatDuration(item.duration_sec) for track length
genre is an array -> render each element as a small chip"""


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = create_malleable_app(MalleableConfig(
    title="Groove Music Demo",
    cors_origins=["http://localhost:3002"],
    system_prompt=_SYSTEM_PROMPT,
    manifest_models=None,
    chat_request_model=ChatRequest,
    ui_schema_model=UISchema,
    base_generator=groove_generator,
    default_card_fields=["title", "artist", "duration_sec"],
    component_scope="Groove music player. Fields: id, title, artist, album, genre (string[]), duration_sec (number), bpm, audio_url, playlist_id. Scope: formatDate(iso), formatDuration(sec), groupItems(items, field), currentTrackId. Props: items, onItemClick. Highlight currentTrackId. Use formatDuration for duration_sec. Never show audio_url.",
))

app.include_router(crud)
