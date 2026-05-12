# Deployment Guide

This project deploys the frontend to Vercel and the backend to Railway,
both connected to the same GitHub repository.

---

## Backend — Railway

1. Go to https://railway.app and create a new project.
2. Choose **Deploy from GitHub repo** and select this repository.
3. When prompted for the service root, set it to `demo/backend`.
   (Railway calls this the "Root Directory" in service settings.)
4. Railway will auto-detect the `Procfile` and use:
   `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Add the following environment variables in the Railway service settings:
   - `ANTHROPIC_API_KEY` — your Anthropic API key
   - `ALLOWED_ORIGINS` — the Vercel frontend URL, e.g.
     `https://your-project.vercel.app`
     (comma-separate multiple origins if needed)
6. Deploy. Copy the public Railway URL (e.g. `https://your-project.up.railway.app`).

---

## Frontend — Vercel

1. Go to https://vercel.com and create a new project.
2. Import the same GitHub repository.
3. In the **Root Directory** setting, enter: `demo/frontend`
   This is required because the Next.js app is not at the repo root.
4. Framework Preset will auto-detect as **Next.js** — leave it.
5. Add the following environment variable:
   - `NEXT_PUBLIC_API_URL` — the Railway backend URL from step 6 above,
     e.g. `https://your-project.up.railway.app`
6. Deploy.

---

## Local development

Backend:
```bash
cd demo/backend
pip install -r requirements.txt
ANTHROPIC_API_KEY=sk-... uvicorn main:app --reload
```

Frontend:
```bash
cd demo/frontend
npm install
# NEXT_PUBLIC_API_URL defaults to http://localhost:8000 when unset
npm run dev
```

---

## Environment variable summary

| Variable | Where | Value |
|---|---|---|
| `ANTHROPIC_API_KEY` | Railway | Your Anthropic API key |
| `ALLOWED_ORIGINS` | Railway | Vercel deployment URL(s), comma-separated |
| `NEXT_PUBLIC_API_URL` | Vercel | Railway backend URL |
