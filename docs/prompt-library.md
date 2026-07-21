# Prompt Library — Meeting Notes Summarizer

An annotated catalog of the 10 prompts used to plan and scaffold this project: 3 planning
prompts (produced the PRD, the architecture doc, and the vibe-coding spec) and 7 implementation
task prompts (drive the actual build, full text in
[docs/vibe-coding-spec.md](./vibe-coding-spec.md) §6).

---

## Planning Prompts

### 1. Idea Brief + PRD generation
**What it does:** Asked the model to act as a product manager and, from a one-paragraph
description of the tool (paste notes → structured summary → localStorage, 3-hour build),
produce a 1-page Idea Brief (problem, target user, value prop, MVP scope, top 3 risks,
biggest assumption) and a full 9-section PRD (problem, users, user stories, features with
acceptance criteria, NFRs, out-of-scope, success metrics, open questions, constraints).
**Targets:** `docs/product-brief-and-prd.md` — the scope-defining phase; every later document
in this project references it.

### 2. Architecture generation
**What it does:** Given the accepted PRD, specified the concrete stack (React/Vite frontend,
Node/Express backend serving both the API and the built frontend from one process, no
database, Railway/Render deployment) and asked for a 6-section technical architecture document
— tech stack, components, data model, API design, implementation sequence, risks — with the
`/api/summarize` endpoint's request/response/error shapes fully specified.
**Targets:** `docs/technical-architecture.md` — the design phase; fixes the exact contracts
(API shape, error codes, localStorage schema) that all task prompts build against.

### 3. Vibe-coding spec generation (this prompt)
**What it does:** Given the accepted PRD and architecture doc, asked for an 8-section
"vibe-coding" spec plus a breakdown into individual, self-contained task prompts — one each for
Express setup, the `/api/summarize` route, the React components, localStorage persistence,
error handling, tests, and deployment — each written so it could be handed to a coding agent
with no other context.
**Targets:** `docs/vibe-coding-spec.md` — the execution-planning phase; produces the 7 task
prompts cataloged below.

---

## Implementation Task Prompts

Full prompt text for each of these lives in
[docs/vibe-coding-spec.md](./vibe-coding-spec.md) §6 — linked below rather than duplicated.

### 4. Task 1 — Express server setup
**What it does:** Scaffolds the Express app (`server/index.ts`), wires `dotenv` config loading,
reserves the `/api` mount point, serves the built React app as static files with an SPA
catch-all route, and sets up the `dev`/`build`/`start` npm scripts.
**Targets:** Backend bootstrap — `server/index.ts`, root `package.json`.
→ [docs/vibe-coding-spec.md §6, Task 1](./vibe-coding-spec.md#task-1--express-server-setup)

### 5. Task 2 — `/api/summarize` route + Claude client
**What it does:** Implements the Claude API integration (`claude-haiku-4-5-20251001`,
structured outputs via `output_config.format`) and the Express route that validates input,
calls it, and maps success/timeout/failure to the three documented HTTP responses.
**Targets:** `server/services/claudeClient.ts`, `server/routes/summarize.ts` — the one backend
endpoint the app needs.
→ [docs/vibe-coding-spec.md §6, Task 2](./vibe-coding-spec.md#task-2--apisummarize-route--claude-client)

### 6. Task 3 — React frontend components (happy path)
**What it does:** Builds the four core UI components — `InputPanel`, `SummaryView`,
`HistoryList`, and a placeholder `ErrorBanner` — plus the `api.ts` fetch wrapper, and wires them
together in `App.tsx` for the golden-path flow (paste → summarize → render).
**Targets:** `client/src/components/*.tsx`, `client/src/lib/api.ts`, `client/src/App.tsx` — the
frontend happy path.
→ [docs/vibe-coding-spec.md §6, Task 3](./vibe-coding-spec.md#task-3--react-frontend-components-happy-path)

### 7. Task 4 — `localStorage` persistence layer
**What it does:** Implements the versioned `localStorage` read/write/delete layer
(`mns:v1:summaries`) and wires it into `App.tsx` so summaries auto-save on success and survive
a page reload, with corrupted-data recovery.
**Targets:** `client/src/lib/storage.ts` — the persistence requirement (PRD F3/F4).
→ [docs/vibe-coding-spec.md §6, Task 4](./vibe-coding-spec.md#task-4--localstorage-persistence-layer)

### 8. Task 5 — Frontend error handling
**What it does:** Maps each of the three backend error codes (`EMPTY_INPUT`,
`SUMMARIZATION_FAILED`, `TIMEOUT`) to a distinct user-facing message, finishes the
`ErrorBanner` component, and confirms input is preserved and loading state always resolves on
failure.
**Targets:** `client/src/components/ErrorBanner.tsx`, `client/src/lib/api.ts` — the error-path
requirement (PRD F5).
→ [docs/vibe-coding-spec.md §6, Task 5](./vibe-coding-spec.md#task-5--frontend-error-handling)

### 9. Task 6 — Basic tests
**What it does:** Adds a Vitest suite covering the backend route's three error codes and
success path (Claude client mocked, no real network calls) and the `storage.ts` persistence
layer (including corrupted-data recovery).
**Targets:** `server/routes/summarize.test.ts`, `client/src/lib/storage.test.ts` — the
highest-value regression coverage at this project's scope.
→ [docs/vibe-coding-spec.md §6, Task 6](./vibe-coding-spec.md#task-6--basic-tests)

### 10. Task 7 — Deployment to Railway/Render
**What it does:** Finalizes `build`/`start` scripts so `npm install && npm run build && npm
start` is sufficient on either platform, confirms `.env` is git-ignored, and documents setting
`ANTHROPIC_API_KEY` as a platform environment variable.
**Targets:** Root `package.json`, optional platform config file — the deployment phase.
→ [docs/vibe-coding-spec.md §6, Task 7](./vibe-coding-spec.md#task-7--deployment-to-railwayrender)
