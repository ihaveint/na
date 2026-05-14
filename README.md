# N/A

> Same data. Any interface.

N/A is an adaptive UI framework where users describe how they want their data displayed in natural language, and an AI agent builds it for them — in real time.

## What it does

Instead of a fixed UI that everyone uses the same way, N/A lets each user reshape the interface to fit their workflow. Simple requests ("sort by urgency", "show as kanban") update a config schema instantly. Complex requests ("show as a heatmap grouped by sender", "timeline with urgency indicators") generate a live React component on the fly.

The framework is domain-agnostic — annotate any FastAPI backend with `@semantic` and the frontend adapts automatically. The repo includes two demos: an email client (`demo/`) and a finance ledger (`demo2/`).

## Features

- **Conversational agent** — chat with the AI to describe what you want. It asks follow-up questions when your request is ambiguous.
- **Schema mode** — fast config-based rendering for standard layouts (list, kanban, table, calendar) with sorting, filtering, and grouping.
- **Code mode** — the agent generates a full React component for novel layouts not expressible as config.
- **Surgical edits** — click any element in a generated component, then describe the change. The agent edits only the relevant sub-component.
- **Inspect** — click any element in the rendered UI to open a conversation scoped to that element.
- **Personas** — switchable user profiles, each with a default layout that persists across sessions.
- **Version history** — every layout change is saved; browse and restore previous versions.
- **Share** — copy a shareable link that encodes the current schema or generated component.
- **Draggable chat** — the chat button can be repositioned anywhere on screen; collapses to a bottom sheet on mobile.

## Project structure

```
.
├── sdk/                  # Python SDK
│   └── malleable/        # @semantic decorator + manifest generator
├── demo/                 # Email client demo
│   ├── backend/          # FastAPI server + Claude integration
│   └── frontend/         # Next.js app
└── demo2/                # Finance ledger demo
    ├── backend/
    └── frontend/
```

## Running locally

**Prerequisites:** Python 3.9+, Node.js, an Anthropic API key.

### Backend

```bash
cd demo/backend
python -m venv venv
source venv/bin/activate
pip install -e ../../sdk
pip install -r requirements.txt
cp .env.example .env   # add your ANTHROPIC_API_KEY
uvicorn main:app --reload
```

Runs at `http://localhost:8000`.

### Frontend

```bash
cd demo/frontend
npm install
npm run dev
```

Runs at `http://localhost:3000`. Start the backend first.

## SDK

### `@semantic`

Annotate FastAPI endpoints so the manifest knows what data they expose and where to fetch it:

```python
from malleable import semantic, generate_manifest

@semantic(
    entity="Track",
    intent="list_all",
    description="All tracks, newest first",
    path="/tracks",          # required: tells the frontend which URL to fetch
)
@app.get("/tracks", response_model=list[Track])
async def list_tracks():
    ...

@semantic(entity="Track", operation="favorite", description="Mark a track as favorited")
@app.post("/tracks/{id}/favorite")
async def favorite_track(id: str):
    ...
```

`intent` is for read endpoints; `operation` is for write endpoints. The `path=` parameter is required on list endpoints so the frontend can resolve the data URL without hardcoding it.

### `generate_manifest`

Expose the manifest at a `/manifest` route so the frontend can read entity fields, endpoint paths, and data-source options at runtime:

```python
@app.get("/manifest")
async def get_manifest():
    return generate_manifest([Track, Album, Artist])
```

Pass your Pydantic model classes so the manifest includes field types and descriptions, not just endpoint metadata.

## How it works

1. The backend exposes a `/manifest` endpoint describing entities, fields, and list endpoints with their fetch paths.
2. On load, the frontend fetches the manifest and resolves `data_source → URL` dynamically — no hardcoded paths in the frontend.
3. The AI chat endpoint receives the manifest at request time and builds its system prompt from it, so the agent knows your domain's field names, types, and data sources without any manual prompt editing.
4. Generated React components receive `items: Entity[]` and `onItemClick` as props; the Babel sandbox injects `formatDate`, `groupItems`, and other helpers.

## Tech stack

- **Backend:** FastAPI, Anthropic SDK (claude-sonnet-4-6), Pydantic
- **Frontend:** Next.js, React 19, Tailwind CSS, TypeScript
- **SDK:** Python 3.9+
