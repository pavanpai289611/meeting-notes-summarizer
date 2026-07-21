# Meeting Notes Summarizer — Vibe-Coding Spec & Task Prompts

Source documents: [docs/product-brief-and-prd.md](./product-brief-and-prd.md) (scope, acceptance criteria) and [docs/technical-architecture.md](./technical-architecture.md) (stack, components, API design). This document translates those into a sequence of self-contained prompts an AI coding agent can execute one at a time.

---

## 1. Purpose & How to Use This Spec

This is a build runbook, not a design document — the design decisions are already made in the PRD and architecture doc. Each task in §6 is written to be pasted directly to a coding agent (Claude Code, Cursor, etc.) as its entire instruction — it repeats the contracts it depends on rather than assuming the agent has read the other docs, so tasks can be run in separate sessions without losing context.

**Rules for running the tasks:**
- Run them in order (§5) — later tasks assume earlier ones' files exist.
- After each task, do a quick manual smoke check (the "Verify" line in each prompt) before moving to the next — this is a 3-hour build; catching a broken contract early is cheaper than debugging it after three more tasks are layered on top.
- If a task's output doesn't match its "Files produced" list, stop and fix before continuing — later tasks import from these exact paths.

---

## 2. Recap: What We're Building

A single-user web tool: paste raw meeting notes/transcript text → get a structured summary (Key Discussion Points / Decisions Made / Action Items with owner-or-"Unassigned") → summaries auto-save to browser `localStorage`. No login, no database. One Express server serves both the API and the built React frontend, deployed as a single service on Railway or Render.

**Out of scope for this build** (see PRD §2.6 for the full list): auth, a backend database, audio/video transcription, editing generated summaries, third-party export/integrations, rate limiting/cost dashboards.

---

## 3. Architecture Recap

| Layer | Choice |
|---|---|
| Frontend | React 18 + Vite, built to static `client/dist` |
| Backend | Node.js + Express — serves `/api/summarize` **and** the static frontend from one process |
| LLM | Claude API via `@anthropic-ai/sdk`, model `claude-haiku-4-5-20251001`, structured outputs via `output_config.format` |
| Persistence | Browser `localStorage` only, key `mns:v1:summaries` — nothing persisted server-side |
| Config | `dotenv` locally (`.env`, git-ignored), platform environment variable in production |
| Deployment | Railway or Render, single Node service |

```
meeting-notes-summarizer/
├── client/                      # React app (Vite)
│   └── src/
│       ├── App.tsx
│       ├── components/{InputPanel,SummaryView,HistoryList,ErrorBanner}.tsx
│       ├── lib/{api,storage}.ts
│       └── types.ts
├── server/                      # Express app (Node)
│   ├── index.ts
│   ├── routes/summarize.ts
│   └── services/claudeClient.ts
├── .env                         # local only, git-ignored
└── package.json
```

---

## 4. Shared Contracts

These are the exact shapes every task below must produce/consume. Copy them verbatim — don't paraphrase field names.

### TypeScript types (`client/src/types.ts`, mirrored server-side)
```ts
interface ActionItem {
  task: string;
  owner: string; // mentioned owner's name, or the literal string "Unassigned"
}

interface Summary {
  keyDiscussionPoints: string[];
  decisionsMade: string[];
  actionItems: ActionItem[];
}

interface SummaryRecord {
  id: string;         // crypto.randomUUID()
  createdAt: string;  // ISO 8601
  inputText: string;
  summary: Summary;
}
```

### `POST /api/summarize`
Request:
```json
{ "transcript": "string, required, non-empty after trim" }
```
Success — `200 OK`:
```json
{ "summary": { "keyDiscussionPoints": [], "decisionsMade": [], "actionItems": [] } }
```
Error — shared envelope, three possible codes:
```json
{ "error": { "code": "EMPTY_INPUT | SUMMARIZATION_FAILED | TIMEOUT", "message": "string" } }
```

| Code | HTTP status | When |
|---|---|---|
| `EMPTY_INPUT` | 400 | `transcript` missing or whitespace-only |
| `SUMMARIZATION_FAILED` | 502 | Claude API call errors (auth, rate limit, 5xx, schema mismatch) |
| `TIMEOUT` | 504 | Claude API call exceeds the client-side request timeout |

### `localStorage` schema
- Key: `mns:v1:summaries`
- Value: JSON-serialized `SummaryRecord[]`, most-recent-first is a UI sort concern, not a storage-order requirement.

---

## 5. Task Sequencing

| # | Task | Depends on | Primary files |
|---|---|---|---|
| 1 | Express server setup | — | `server/index.ts`, `package.json` |
| 2 | `/api/summarize` route + Claude client | 1 | `server/services/claudeClient.ts`, `server/routes/summarize.ts` |
| 3 | React frontend components (happy path) | 1 | `client/src/**` |
| 4 | `localStorage` persistence layer | 3 | `client/src/lib/storage.ts` |
| 5 | Frontend error handling | 2, 3 | `client/src/components/ErrorBanner.tsx`, `client/src/lib/api.ts` |
| 6 | Basic tests | 2, 4 | `server/**/*.test.ts`, `client/src/**/*.test.ts` |
| 7 | Deployment to Railway/Render | 1–6 | `package.json`, platform config |

---

## 6. Task Prompts

Each block below is meant to be copy-pasted as-is to a coding agent.

### Task 1 — Express server setup

```
You are setting up the backend for a small full-stack app called "Meeting Notes Summarizer."
Stack: Node.js + Express (TypeScript), serving both a JSON API and a pre-built React static site
from ONE process — no separate frontend host, no reverse proxy.

Project layout (create what doesn't exist):
meeting-notes-summarizer/
├── client/            # React app — assume this already exists with a `dist/` build output
├── server/
│   ├── index.ts
│   ├── routes/        # empty for now, a later task adds routes/summarize.ts
│   └── services/      # empty for now, a later task adds services/claudeClient.ts
├── .env                # local only — must be git-ignored
├── .gitignore
└── package.json

Requirements for server/index.ts:
1. Create an Express app with `express.json()` middleware.
2. Load environment variables via `dotenv` at the top of the file (`dotenv.config()`), so a
   local `.env` file populates `process.env` in dev, and a no-op in production where the
   platform (Railway/Render) injects env vars directly.
3. Reserve a mount point for the API: routes under `/api/*` will be added by a later task —
   leave a clear comment `// API routes mounted here` where `app.use('/api', ...)` should go,
   registered BEFORE the static/catch-all handler below.
4. Serve the built frontend as static files from `client/dist` via `express.static(...)`.
5. Add a catch-all GET route (after the API mount point, matching anything not already
   handled) that returns `client/dist/index.html`, so client-side routing/refresh works for a
   single-page app. Do NOT let this catch-all intercept `/api/*` — mounting order handles this
   as long as the API routes are registered first.
6. Listen on `process.env.PORT || 3000` (Railway/Render inject `PORT`; default to 3000 locally).
7. Add npm scripts to the root package.json:
   - "dev": runs the Express server with a TS dev runner (e.g. ts-node-dev or tsx) against
     server/index.ts, for local development against an already-running `vite dev` on another
     port (don't build a proxy — just document that the two run separately in dev).
   - "build": runs `vite build` inside client/, producing client/dist.
   - "start": runs the compiled/production server (node, pointed at server/index.ts via tsx
     or after a `tsc` build — pick one approach and be consistent) — this is what
     Railway/Render will run in production, so it must work with only `npm install && npm run
     build && npm start`.
8. Add a `.gitignore` entry for `.env`, `node_modules`, and `client/dist`.

Do not implement the /api/summarize route itself — that's a separate task. Just make sure
there's a clean, obvious place for it to be mounted.

Verify: `npm run build && npm start` boots the server without errors, and visiting
`http://localhost:3000/` in a browser (or `curl`) returns the built index.html.
```

### Task 2 — `/api/summarize` route + Claude client

```
You are implementing the only backend API endpoint for "Meeting Notes Summarizer," a tool that
turns pasted meeting notes/transcripts into a structured summary. The Express app already
exists (server/index.ts, with `// API routes mounted here` marking where to add `app.use('/api',
...)`). Your job is to build the route and the Claude API integration behind it.

Install the Anthropic Node SDK: `npm install @anthropic-ai/sdk`.

Create server/services/claudeClient.ts:
- Construct an Anthropic client reading the API key from `process.env.ANTHROPIC_API_KEY`
  (never hardcode it, never send it to the frontend).
- Set an explicit request timeout on the client (e.g. 30 seconds) so a hung request fails
  fast and distinguishably from other errors — check the SDK's client-config option for a
  per-client or per-request timeout (Python/Ruby: seconds; TypeScript: milliseconds — confirm
  which unit the installed SDK version expects before setting it).
- Export a function `summarizeTranscript(transcript: string): Promise<Summary>` where:
  ```ts
  interface ActionItem { task: string; owner: string; }
  interface Summary {
    keyDiscussionPoints: string[];
    decisionsMade: string[];
    actionItems: ActionItem[];
  }
  ```
- Call `client.messages.create(...)` with:
  - `model: "claude-haiku-4-5-20251001"`
  - A system or user prompt instructing Claude to extract: key discussion points, decisions
    made, and action items (each with an owner if one is explicitly named in the source text,
    or the literal string "Unassigned" if not — never guess an owner that isn't stated).
  - `output_config: { format: { type: "json_schema", schema: <JSON Schema matching the
    Summary interface above, with additionalProperties: false and all three top-level keys
    required> } }` — this guarantees the response is valid JSON matching the shape, so you do
    NOT need to regex-parse or markdown-strip the model's output.
  - A reasonable `max_tokens` for a summary-length response (e.g. 2048).
- Parse the structured response and return it typed as `Summary`. If the SDK exposes a typed
  `parsed_output` / `parsedOutput` for structured outputs, prefer that over manually
  `JSON.parse`-ing a text block.
- Let errors propagate — do not catch them here. The route handler (below) is responsible for
  turning them into the shared error envelope.

Create server/routes/summarize.ts (an Express Router):
- `POST /` (mounted at `/api/summarize` from server/index.ts, i.e. `app.use('/api/summarize',
  summarizeRouter)` where the router itself only defines `router.post('/', handler)` — or
  mount at `/api` with the route as `/summarize`, whichever is cleaner given how index.ts's
  placeholder comment is structured; be consistent with Task 1's file).
- Read `req.body.transcript`. If it is missing, not a string, or empty/whitespace-only after
  `.trim()`, respond `400` with:
  ```json
  { "error": { "code": "EMPTY_INPUT", "message": "Please paste some meeting notes before summarizing." } }
  ```
  Do NOT call Claude in this case.
- Otherwise, call `summarizeTranscript(transcript)` inside a try/catch:
  - If the error is a timeout (check for the SDK's timeout/connection-timeout error type —
    e.g. `APIConnectionTimeoutError` in the Python SDK; confirm the TypeScript SDK's equivalent
    class name before writing the check), respond `504`:
    ```json
    { "error": { "code": "TIMEOUT", "message": "Summarization is taking too long. Please try again." } }
    ```
  - For any other error (auth failure, rate limit, 5xx from Claude, schema validation
    failure), respond `502`:
    ```json
    { "error": { "code": "SUMMARIZATION_FAILED", "message": "Something went wrong generating the summary. Please try again." } }
    ```
  - Log the actual underlying error server-side (console.error with detail) in both cases —
    but never include upstream error detail in the JSON response sent to the client.
  - On success, respond `200` with `{ "summary": <the Summary object> }`.
- Wire this router into server/index.ts at the `// API routes mounted here` comment, replacing
  it with the actual `app.use(...)` call.

Verify: with a valid ANTHROPIC_API_KEY in .env, `curl -X POST http://localhost:3000/api/summarize
-H "Content-Type: application/json" -d '{"transcript":"Alice and Bob discussed the Q1 roadmap.
They decided to ship the beta in March. Alice will draft the announcement."}'` returns a 200
with all three summary sections populated and Alice correctly attributed as the owner of the
action item. `curl` with `{"transcript":""}` returns a 400 with code EMPTY_INPUT.
```

### Task 3 — React frontend components (happy path)

```
You are building the frontend for "Meeting Notes Summarizer" — a React (Vite, TypeScript) app
that lets a user paste meeting notes, click "Summarize," and see a structured result. The
backend already exposes POST /api/summarize (same-origin, no CORS needed) — see the contract
below. This task covers the happy path UI only; a later task hardens error handling.

Create client/src/types.ts:
```ts
export interface ActionItem { task: string; owner: string; }
export interface Summary {
  keyDiscussionPoints: string[];
  decisionsMade: string[];
  actionItems: ActionItem[];
}
export interface SummaryRecord {
  id: string;
  createdAt: string; // ISO 8601
  inputText: string;
  summary: Summary;
}
```

Create client/src/lib/api.ts:
- `export async function summarize(transcript: string): Promise<Summary>` — POSTs
  `{ transcript }` as JSON to `/api/summarize`.
- On a non-2xx response, parse the JSON error envelope `{ error: { code, message } }` and throw
  an `Error` whose `.message` is set to a small custom error object or a tagged string so the
  caller can distinguish `code` — e.g. throw a custom `ApiError extends Error` class carrying
  a `code: string` field, since the frontend will need to branch on `EMPTY_INPUT` /
  `SUMMARIZATION_FAILED` / `TIMEOUT` in a later task. Export this `ApiError` class.
- On success, return the parsed `summary` object.

Create client/src/components/InputPanel.tsx:
- A large `<textarea>` for pasting raw text, and a "Summarize" button.
- Button is disabled when the textarea is empty or whitespace-only, and while a request is in
  flight (show a loading indicator/spinner text like "Summarizing…" on the button in that
  state).
- Props: `value: string`, `onChange: (text: string) => void`, `onSubmit: () => void`,
  `isLoading: boolean`. Keep this component presentational — no fetch logic inside it.

Create client/src/components/SummaryView.tsx:
- Props: `summary: Summary | null`.
- Renders three sections in this fixed order: "Key Discussion Points", "Decisions Made",
  "Action Items" — as headings, each followed by a bulleted list of its array.
- If `summary` is null, render nothing (or a subtle empty state — your call).
- If a given section's array is empty, render an explicit "None identified." line instead of
  an empty list.
- Each action item renders as `{task} — {owner}` (owner will already be "Unassigned" when not
  stated, from the backend — don't add extra logic here to detect that).

Create client/src/components/HistoryList.tsx:
- Props: `records: SummaryRecord[]`, `onSelect: (record: SummaryRecord) => void`,
  `onDelete: (id: string) => void`.
- Renders `records` as a list, most-recent-first (assume the caller already sorted them),
  each showing `createdAt` (human-readable, e.g. via `toLocaleString()`) and a short snippet —
  the first ~60 characters of `inputText`, with "…" appended if truncated.
- Clicking a list item calls `onSelect(record)`.
- Each item has a delete control that calls `onDelete(record.id)` — before calling it, show a
  native `window.confirm(...)` prompt; only call `onDelete` if the user confirms.

Create client/src/components/ErrorBanner.tsx as a minimal placeholder for now:
- Props: `message: string | null`.
- Renders nothing if `message` is null; otherwise renders the message in a visually distinct
  (e.g. red-bordered) banner. A later task will wire this up to the three backend error codes
  with more specific per-code messages — for this task, just make the component exist and
  render whatever string it's given.

Wire it all together in client/src/App.tsx:
- State: `inputText: string`, `currentSummary: Summary | null`, `isLoading: boolean`,
  `errorMessage: string | null`, `history: SummaryRecord[]` (leave `history` as an empty array
  managed by local state for now — a later task replaces this with real localStorage
  persistence; don't build storage logic in this task).
- On submit: call `summarize(inputText)` from lib/api.ts, set `isLoading` around the call, set
  `currentSummary` on success and clear `errorMessage`; on failure, set `errorMessage` to
  `error.message` and leave `currentSummary` untouched.
- Render InputPanel, ErrorBanner, SummaryView, and HistoryList together in a simple layout —
  polish is not required, correctness of data flow is.

Verify: with the backend running, pasting text and clicking Summarize renders all three
sections with real data from Claude. An empty textarea keeps the button disabled.
```

### Task 4 — `localStorage` persistence layer

```
You are adding client-side persistence to "Meeting Notes Summarizer," a React app that
currently holds its summary history only in React state (from a prior task). Your job is to
back that history with the browser's localStorage so it survives a page reload, using a
versioned storage key so a future format change doesn't crash on old data.

Context — existing types (client/src/types.ts), do not redefine them, import instead:
```ts
export interface ActionItem { task: string; owner: string; }
export interface Summary {
  keyDiscussionPoints: string[];
  decisionsMade: string[];
  actionItems: ActionItem[];
}
export interface SummaryRecord {
  id: string;
  createdAt: string;
  inputText: string;
  summary: Summary;
}
```

Create client/src/lib/storage.ts with these exports:
- `const STORAGE_KEY = "mns:v1:summaries";` (exported as a named constant, not inlined
  elsewhere, so a future `v2` migration has one place to change).
- `export function loadRecords(): SummaryRecord[]` — reads `localStorage.getItem(STORAGE_KEY)`,
  JSON-parses it, and returns the array. If the key doesn't exist, or `JSON.parse` throws (e.g.
  corrupted data), return `[]` rather than throwing — this must never crash the app on load.
- `export function saveRecord(record: SummaryRecord): SummaryRecord[]` — loads existing
  records via `loadRecords()`, prepends the new record (most-recent-first), writes the full
  array back to `localStorage` via `JSON.stringify`, and returns the updated array so the
  caller can update React state without a second read.
- `export function deleteRecord(id: string): SummaryRecord[]` — loads existing records,
  filters out the one matching `id`, writes the result back, and returns the updated array.
- Use `crypto.randomUUID()` for generating new record IDs — but do that at the call site
  (App.tsx), not inside storage.ts, since storage.ts should only persist records it's given,
  not construct them.

Wire this into client/src/App.tsx (which currently manages `history` as local-only React
state from a prior task):
- On mount (`useEffect` with an empty dependency array), call `loadRecords()` and set it as the
  initial `history` state.
- On a successful summarize call, construct a `SummaryRecord` (`{ id: crypto.randomUUID(),
  createdAt: new Date().toISOString(), inputText, summary }`), call `saveRecord(...)`, and set
  the returned array as the new `history` state — this is the "auto-save with no extra save
  action" behavior.
- Wire HistoryList's `onSelect` to set `currentSummary` (and `inputText`, so re-selecting an
  old entry shows the original pasted text too) from the selected record.
- Wire HistoryList's `onDelete` to call `deleteRecord(id)` and set the returned array as the
  new `history` state.

Verify: summarizing a transcript, then reloading the page, still shows that summary in the
history list. Deleting an entry (after confirming the browser prompt) removes it and the
removal survives a reload. Manually corrupting the localStorage value via devtools (e.g.
`localStorage.setItem("mns:v1:summaries", "not json")`) and reloading does not crash the app —
it should just show an empty history.
```

### Task 5 — Frontend error handling

```
You are hardening error handling in "Meeting Notes Summarizer," a React app whose backend
returns errors in this shared envelope:
```json
{ "error": { "code": "EMPTY_INPUT | SUMMARIZATION_FAILED | TIMEOUT", "message": "string" } }
```
A prior task built client/src/lib/api.ts with a `summarize()` function that throws a custom
`ApiError` (extending `Error`, carrying a `code: string` field) on any non-2xx response, and a
placeholder client/src/components/ErrorBanner.tsx that just renders whatever message string
it's given. Your job is to map each error code to a distinct, user-appropriate message and make
sure the UI recovers correctly from each case — this is the "clear feedback on failure" and
"input preserved on failure" behavior described in the PRD.

In client/src/lib/api.ts (or a new client/src/lib/errorMessages.ts, your choice — keep it in
one place):
- Add a function `getErrorMessage(error: unknown): string` that:
  - If `error instanceof ApiError`, switches on `error.code`:
    - `"EMPTY_INPUT"` → "Please paste some meeting notes before summarizing."
    - `"TIMEOUT"` → "Summarization is taking too long. Please try again in a moment."
    - `"SUMMARIZATION_FAILED"` → "Something went wrong generating the summary. Please try
      again."
    - any other/unknown code → a generic fallback message, e.g. "Something went wrong.
      Please try again."
  - If `error` is a plain network failure (e.g. `fetch` itself rejected — the request never
    reached the server, so there's no JSON envelope to parse), return a distinct message like
    "Couldn't reach the server. Check your connection and try again."
  - Never surface a raw stack trace, raw `error.message` from an unexpected error shape, or
    any backend implementation detail to the user.

In client/src/App.tsx:
- In the catch block around the `summarize()` call, call `getErrorMessage(error)` and set that
  as `errorMessage` state (passed to `ErrorBanner`).
- Confirm (and fix if not already the case) that `inputText` is NOT cleared when an error
  occurs — the user's pasted text must still be in the textarea after a failed request, so
  they can retry without re-pasting.
- Confirm that a new successful submission clears any previously shown `errorMessage` (don't
  leave a stale error banner showing next to a fresh successful summary).
- Confirm the "Summarize" button's disabled/loading state always resolves — i.e. `isLoading`
  is set back to `false` in both the success and error paths (use try/finally if it isn't
  already structured that way).

Improve client/src/components/ErrorBanner.tsx if needed so the rendered banner is clearly
distinguishable as an error (not just plain text) — a colored border/background and an icon or
"Error:" prefix is enough; this doesn't need visual polish beyond being unambiguous.

Verify manually by temporarily forcing each backend error path (e.g. submit an empty transcript
for EMPTY_INPUT; temporarily set an invalid ANTHROPIC_API_KEY to trigger SUMMARIZATION_FAILED;
temporarily set the server's Claude client timeout to an unreasonably low value like 1ms to
trigger TIMEOUT) and confirming each shows a distinct, sensible message, the textarea still
has the original text, and the button is clickable again afterward. Revert any temporary
changes made purely to trigger these states.
```

### Task 6 — Basic tests

```
You are adding a minimal automated test suite to "Meeting Notes Summarizer" — this is a 3-hour
build, so the goal is confidence on the parts most likely to silently break, not full coverage.
Use Vitest for both the frontend and backend (it works for plain TypeScript/Node code as well
as React, so one test runner covers both halves — add it as a dev dependency at the repo root
if not already present, with a config that picks up both client/src/**/*.test.ts(x) and
server/**/*.test.ts).

Backend tests — create server/routes/summarize.test.ts:
- Mock server/services/claudeClient.ts's `summarizeTranscript` function (e.g. via
  `vi.mock(...)`) so these tests never make a real network call to the Claude API.
- Test 1: POSTing `{ transcript: "" }` (and separately, `{ transcript: "   " }`) to the route
  returns HTTP 400 with `error.code === "EMPTY_INPUT"`, and confirms the mocked
  `summarizeTranscript` was NOT called in this case.
- Test 2: with `summarizeTranscript` mocked to resolve with a sample `Summary` object, POSTing
  a valid non-empty transcript returns HTTP 200 with `{ summary: <that same object> }`.
- Test 3: with `summarizeTranscript` mocked to reject with a generic `Error`, POSTing a valid
  transcript returns HTTP 502 with `error.code === "SUMMARIZATION_FAILED"`.
- Test 4: with `summarizeTranscript` mocked to reject with whatever error type/shape the route
  handler checks for timeouts (match however Task 2 implemented that check), returns HTTP 504
  with `error.code === "TIMEOUT"`.
- Use `supertest` (add as a dev dependency) against the Express app instance to make these
  HTTP-level assertions rather than calling the route handler function directly.

Frontend tests — create client/src/lib/storage.test.ts:
- These test the localStorage persistence layer in isolation (jsdom's localStorage
  implementation, which Vitest provides by default in a jsdom/browser test environment —
  configure that environment for client tests if not already set).
- Reset `localStorage.clear()` in a `beforeEach` so tests don't leak state into each other.
- Test 1: `loadRecords()` on empty storage returns `[]`.
- Test 2: `saveRecord(...)` followed by `loadRecords()` returns an array containing the saved
  record.
- Test 3: saving two records, then `deleteRecord(id)` on the first one, leaves only the second
  in `loadRecords()`.
- Test 4: manually calling `localStorage.setItem("mns:v1:summaries", "not valid json")` and
  then calling `loadRecords()` returns `[]` rather than throwing.

Add an npm script `"test": "vitest run"` at the repo root. Do not aim for UI component
rendering tests (React Testing Library etc.) in this pass — the route and storage layers are
where a silent regression would be most costly, and that's the bar for "basic tests" at this
project's scope.

Verify: `npm test` runs all of the above and they pass, with zero real network calls made
during the run (confirm by running with no ANTHROPIC_API_KEY set at all — the suite should
still pass, proving the Claude client is fully mocked in the backend tests).
```

### Task 7 — Deployment to Railway/Render

```
You are preparing "Meeting Notes Summarizer" for deployment as a single service on Railway or
Render (the user will pick one — make this work for either without a platform-specific code
branch). The app is a Node/Express server (server/index.ts) that serves both the
/api/summarize endpoint and a built React app (client/dist, produced by Vite). There is no
database and no other backing service — this is the only deployable unit.

Confirm/finalize root package.json scripts so the platform's default build/start convention
works unmodified:
- `"build"`: must produce client/dist AND anything the server needs to run in production (e.g.
  if the server itself is TypeScript run via a compiled step rather than a runtime transpiler,
  include that compile step here too). Running `npm run build` from a clean checkout with
  only `npm install` first must fully prepare the app to start.
- `"start"`: must start the production server (reading `PORT` from the environment, as
  implemented in Task 1) with a single command and no dev-only tooling (no file-watchers, no
  `--inspect`, etc.).
- Confirm `"engines"` in package.json specifies a Node version compatible with what you used
  locally (e.g. `"node": ">=20"`), since Railway/Render use this to pick a runtime.

Add whatever minimal platform config file makes the default build/start flow explicit (pick
based on which platform's docs you have available to confirm current syntax — do not guess at
a schema): a `render.yaml` for Render (service type `web`, `buildCommand: npm run build`,
`startCommand: npm start`), or a `railway.json`/`railway.toml` for Railway with the equivalent
build/start commands. If genuinely unsure of the current schema for either, it's acceptable to
skip the platform-specific config file and rely on the platform's auto-detection of
`package.json`'s `build`/`start` scripts — note in your summary which approach you took and
why.

Environment variables:
- Confirm the app reads `ANTHROPIC_API_KEY` only from `process.env` (already true from Task 2)
  — write a one-paragraph note (as a comment near the top of server/index.ts, or in a short
  DEPLOY.md at the repo root — your choice) telling whoever deploys this to set
  `ANTHROPIC_API_KEY` as a platform environment variable in the Railway/Render dashboard, the
  same variable name used in the local `.env` file, so no code changes are needed between
  environments.
- Confirm `.env` is git-ignored (from Task 1) so the real key is never committed.

Do not add health-check endpoints, logging services, or monitoring integrations — out of scope
for this build (see PRD §2.6). The only goal here is: a fresh clone of this repo, deployed to
either platform with `ANTHROPIC_API_KEY` set in its dashboard, serves the working app at the
platform-assigned URL.

Verify: describe (in your summary, since you may not have live platform access) the exact
manual steps a person would take in the Railway or Render dashboard to deploy this repo and
set the environment variable, and confirm by re-reading package.json that `npm install && npm
run build && npm start` is sufficient with no other manual step.
```

---

## 7. Testing Strategy

Given the 3-hour scope, testing is deliberately narrow rather than comprehensive:

- **Backend route tests (Task 6)** are the highest-value tests in this build — they catch a broken error-code contract (§4) without needing a real Claude API call, by mocking `claudeClient.ts`. A regression here would silently break the frontend's error-handling logic (Task 5), which depends on those exact codes.
- **Storage tests (Task 6)** guard the one genuine data-loss risk in the app: a corrupted `localStorage` value must degrade to an empty history, never a crash.
- **No UI component tests** (React Testing Library, etc.) — the manual "Verify" step in each frontend task prompt is the substitute for this build's timebox. If this project grows past the MVP, component tests for `SummaryView`'s empty-state rendering and `HistoryList`'s delete-confirmation flow would be the natural next additions.
- **No end-to-end tests** (Playwright/Cypress) — out of scope; the manual smoke checks in §6 cover the golden path.

---

## 8. Deployment Checklist

Run through this once Task 7 is complete, before considering the build "shipped":

- [ ] `npm install && npm run build && npm start` succeeds from a clean checkout with no manual steps beyond setting `ANTHROPIC_API_KEY`.
- [ ] `.env` is present in `.gitignore` and was never committed (`git log --all --full-history -- .env` returns nothing).
- [ ] `ANTHROPIC_API_KEY` is set as an environment variable in the Railway/Render dashboard (not in any committed file).
- [ ] The deployed URL serves the frontend at `/` and the API at `/api/summarize` from the same origin (confirm no CORS errors in the browser console when submitting a transcript).
- [ ] A real end-to-end run against the deployed URL: paste a sample transcript, get a real summary back, reload the page, confirm the summary is still in history.
- [ ] Each of the three error codes (§4) has been triggered at least once against the deployed instance (or against local dev before deploying, if triggering `SUMMARIZATION_FAILED`/`TIMEOUT` in production isn't practical) and shows the expected user-facing message.
