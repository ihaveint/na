# N/A

> Same data. Any interface.

N/A is an adaptive UI framework where users describe how they want their data displayed in natural language, and an AI agent builds it for them — in real time.

## What it does

Instead of a fixed UI that everyone uses the same way, N/A lets each user reshape the interface to fit their workflow. Simple requests ("sort by urgency", "show as kanban") update a config schema instantly. Complex requests ("show as a heatmap grouped by sender", "timeline with urgency indicators") generate a live React component on the fly.

The demo is an email client — the same inbox looks completely different depending on who's using it.

## Features

- **Conversational agent** — chat with the AI to describe what you want. It asks follow-up questions when your request is ambiguous.
- **Schema mode** — fast config-based rendering for standard layouts (list, kanban, table, calendar) with sorting, filtering, and grouping.
- **Code mode** — the agent generates a full React component for novel layouts not possible with config alone.
- **Inspect** — click any element in the rendered UI to open a conversation scoped to that element.
- **Personas** — switchable user profiles (Executive, Student, Developer), each with a default layout that persists across sessions.
- **Draggable chat** — the chat button can be repositioned anywhere on screen.

## Project structure

```
.
├── sdk/                  # Python SDK
│   └── malleable/        # @semantic decorator + manifest generator
└── demo/
    ├── backend/          # FastAPI server + Claude integration
    └── frontend/         # Next.js app
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

The `@semantic` decorator lets you annotate FastAPI endpoints so the framework understands what data they expose and what operations they perform:

```python
from malleable import semantic

@semantic(entity="Thread", intent="list_all", description="All threads, newest first")
@app.get("/threads")
async def list_threads():
    ...
```

This auto-generates a semantic manifest that the AI agent uses to understand your app's data model.

## Tech stack

- **Backend:** FastAPI, Anthropic SDK (claude-sonnet-4-6), Pydantic
- **Frontend:** Next.js 16, React 19, Tailwind CSS, TypeScript
- **SDK:** Python 3.9+, Pydantic
