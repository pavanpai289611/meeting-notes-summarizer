# Meeting Notes Summarizer

**Live app:** https://meeting-notes-summarizer-gqhx.onrender.com

AI-powered meeting notes summarizer — paste raw notes or transcripts, get a structured summary
with key discussion points, decisions made, and action items with owners. Built with React
(Vite), Node/Express, and the Claude API. Single-user, no accounts, no database — summaries
are saved in the browser's `localStorage`.

## Features

- **Paste & summarize** — a large textarea accepts multi-line pasted text (tested up to
  20,000+ characters); the "Summarize" button is disabled on empty/whitespace-only input and
  shows a loading state while the request is in flight.
- **Structured output** — every summary renders three fixed sections, in order: Key Discussion
  Points, Decisions Made, Action Items. Empty sections render an explicit "None identified."
  state rather than being blank.
- **Owner attribution** — each action item shows the exact name mentioned in the source text,
  or the literal string `"Unassigned"` if no owner was stated — never a guessed name.
- **Local history** — every successful summary auto-saves to `localStorage` (no separate save
  step), survives a page reload, and can be reopened or deleted (with confirmation) from a
  history list.
- **Clear error handling** — network, timeout, and backend failures each show a distinct,
  human-readable message; your pasted input is preserved so you can retry without re-pasting.
- **Basic mobile-responsive layout** — the input/summarize screen and the history screen are
  usable at phone widths (~375–390px).

See [docs/product-brief-and-prd.md](./docs/product-brief-and-prd.md) for the full PRD and
[docs/technical-architecture.md](./docs/technical-architecture.md) for the architecture.

## Prerequisites

- Node.js `>=20.19.0` (see `engines` in `package.json`)
- An [Anthropic API key](https://console.anthropic.com) with available credit

## Setup

```bash
git clone <this-repo>
cd meeting-notes-summarizer
npm install
```

Create a `.env` file at the repo root (this file is git-ignored):

```
ANTHROPIC_API_KEY=sk-ant-your-real-key-here
```

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Your Claude API key. Read server-side only (`server/services/claudeClient.ts`) — never sent to or exposed in the frontend bundle. |
| `PORT` | No | Port the Express server listens on. Defaults to `3000` locally; set automatically by Railway/Render in production. |

## Local development

The frontend (Vite dev server) and backend (Express) run as two separate processes in dev —
there's no proxy between them, so use the backend's own built output or run both:

```bash
# Terminal 1 — backend (Express + /api/summarize), with hot reload
npm run dev

# Terminal 2 — frontend (Vite dev server with HMR)
cd client && npm run dev
```

Or, to run the whole app as a single process the way it runs in production (build once, then
serve the built frontend from Express):

```bash
npm run build
npm start
```

Either way, the app is available at `http://localhost:3000` once the Express server is running
(the Vite dev server in the two-terminal setup runs on its own port, typically `5173`, for
frontend-only iteration).

## Testing

```bash
npm test
```

Runs the full Vitest suite (backend route tests with the Claude client mocked, no real network
calls; frontend `localStorage` persistence tests via jsdom).

## Build & deploy

```bash
npm install
npm run build   # installs client deps and builds client/dist
npm start       # starts the production Express server, reading PORT from the environment
```

This repo is set up to deploy to [Render](https://render.com) via the included
[`render.yaml`](./render.yaml) Blueprint — see [DEPLOY.md](./DEPLOY.md) for the exact manual
steps (connect the repo, set `ANTHROPIC_API_KEY` in the dashboard, deploy).

## Project docs

- [docs/product-brief-and-prd.md](./docs/product-brief-and-prd.md) — Idea Brief & PRD
- [docs/technical-architecture.md](./docs/technical-architecture.md) — architecture (stack, components, data model, API design, risks)
- [docs/api.md](./docs/api.md) — API reference for `POST /api/summarize`
- [docs/vibe-coding-spec.md](./docs/vibe-coding-spec.md) — implementation task breakdown
- [docs/prompt-library.md](./docs/prompt-library.md) — annotated prompt library
- [docs/impact-assessment.md](./docs/impact-assessment.md) — impact assessment for a post-launch stakeholder change request
- [docs/change-request-backlog-audit.md](./docs/change-request-backlog-audit.md) — acceptance criteria audit for the Sprint 2 change request
- [DEPLOY.md](./DEPLOY.md) — Render deployment steps
