# Meeting Notes Summarizer — Technical Architecture

Scope and feature requirements are defined in [docs/product-brief-and-prd.md](./product-brief-and-prd.md). This document specifies how the system is built to deliver that scope within the 3-hour timebox.

---

## 1. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | React 18 + Vite | Vite gives fast local dev and a simple `vite build` → static `dist/` output. No router needed (single-page view with a local "history" panel, not separate routes). No state-management library — `useState`/`useEffect` + a small `localStorage` hook is enough for this scope. |
| Backend | Node.js + Express | One Express app serves two responsibilities: the `/api/summarize` endpoint and the built frontend's static files. This keeps deployment to a single service (see §Deployment). |
| LLM | Claude API via `@anthropic-ai/sdk` (Node) | Model: `claude-haiku-4-5-20251001` — chosen over Opus for cost, since this is a limited-trial-budget project and structured extraction from a transcript doesn't need Opus-level reasoning. Uses **structured outputs** (`output_config.format` with a JSON schema) so the model's response is guaranteed to match the three-section shape — no regex/markdown parsing of free-text output. |
| Persistence | Browser `localStorage` only | Versioned key `mns:v1:summaries`. Nothing is persisted server-side; the backend is stateless per-request. |
| Config | `dotenv` (local) / platform env vars (production) | `ANTHROPIC_API_KEY` is loaded via `dotenv` from a git-ignored `.env` file in local dev, and set directly as a Railway/Render environment variable in production — same variable name, two different loading mechanisms, no code branching required (`dotenv.config()` is a no-op if the platform already injects the var). |
| Deployment | Railway or Render, single service | The Express server is the only deployable unit: it builds the frontend at build time and serves it, plus the API, from one Node process on one port. No separate static host, no reverse proxy to configure. |

**Why one server instead of separate frontend/backend deploys:** PRD constraints call for a 3-hour build, single user, no auth. A second deployable (e.g., a static host + a separate API service) adds CORS configuration, two sets of environment variables, and two deploy pipelines for no real benefit at this scale. One Express process serving both is simpler to build, deploy, and reason about.

---

## 2. Components

```
meeting-notes-summarizer/
├── client/                      # React app (Vite)
│   ├── src/
│   │   ├── App.tsx              # Top-level layout: InputPanel + SummaryView + HistoryList
│   │   ├── components/
│   │   │   ├── InputPanel.tsx   # Textarea + "Summarize" button + loading state
│   │   │   ├── SummaryView.tsx  # Renders Key Discussion Points / Decisions Made / Action Items
│   │   │   ├── HistoryList.tsx  # List of saved summaries (from localStorage)
│   │   │   └── ErrorBanner.tsx  # Renders a failed-request message, preserves input
│   │   ├── lib/
│   │   │   ├── api.ts           # fetch() wrapper around POST /api/summarize
│   │   │   └── storage.ts       # get/save/delete against localStorage["mns:v1:summaries"]
│   │   └── types.ts             # Shared TS types: Summary, ActionItem, SummaryRecord
│   └── vite.config.ts
├── server/                      # Express app (Node)
│   ├── index.ts                 # App setup: json middleware, static serving, route mount, error handler
│   ├── routes/summarize.ts      # POST /api/summarize handler
│   └── services/claudeClient.ts # Anthropic SDK client + prompt + JSON schema + error mapping
├── .env                         # local only, git-ignored — ANTHROPIC_API_KEY
└── package.json
```

**Request flow:**

```
Browser (React)
   │  paste text, click "Summarize"
   ▼
POST /api/summarize  ──────────────►  Express route handler (routes/summarize.ts)
                                            │  validate input (non-empty, length cap)
                                            ▼
                                       services/claudeClient.ts
                                            │  client.messages.create(...) with output_config.format
                                            ▼
                                       Claude API (Anthropic)
                                            │  structured JSON response
                                            ▼
                                       route handler shapes { summary: {...} }
   ◄────────────────────────────────  200 response
   │
   ▼
Browser saves { inputText, summary, timestamp } to localStorage["mns:v1:summaries"]
Browser renders SummaryView + updates HistoryList
```

**Static serving:** `server/index.ts` serves `client/dist` (the Vite build output) via `express.static(...)`, with a catch-all route (`app.get("*", ...)` before the API routes are excluded) that returns `index.html` for any non-`/api/*` path — standard single-page-app fallback. The API route is registered first so `/api/summarize` never falls through to the static handler.

---

## 3. Data Model

There is no server-side database — the backend never writes anything to disk or a datastore. The "data model" is entirely client-side (what's stored in `localStorage`) plus the two wire-format DTOs exchanged with the backend (defined fully in §4).

**`localStorage` key:** `mns:v1:summaries` (the `v1` segment lets a future format change add a migration or a new key without corrupting old data — see PRD NFR on storage versioning).

**Stored value — array of `SummaryRecord`:**

```ts
interface ActionItem {
  task: string;
  owner: string;       // the mentioned owner's name, or the literal string "Unassigned"
}

interface Summary {
  keyDiscussionPoints: string[];
  decisionsMade: string[];
  actionItems: ActionItem[];
}

interface SummaryRecord {
  id: string;           // crypto.randomUUID()
  createdAt: string;    // ISO 8601 timestamp
  inputText: string;    // the original pasted text, for re-display
  summary: Summary;
}

// localStorage.getItem("mns:v1:summaries") → SummaryRecord[]
```

`HistoryList` renders `createdAt` + a short snippet derived from `inputText` (first ~60 chars) for each record, most recent first. Deleting removes the record from the array and re-serializes it back to `localStorage`.

---

## 4. API Design — `POST /api/summarize`

This is the only backend endpoint the app needs.

### Method & Path
```
POST /api/summarize
Content-Type: application/json
```

### Request body
```json
{
  "transcript": "string — the raw pasted meeting notes/transcript text"
}
```
- `transcript` is required and must be a non-empty string after trimming whitespace.
- No explicit character cap is enforced in v1 (see PRD open question #1/#2); the Claude API's own context window is the practical ceiling.

### Success response — `200 OK`
```json
{
  "summary": {
    "keyDiscussionPoints": [
      "The team debated whether to launch the beta in Q1 or Q2.",
      "Marketing raised concerns about messaging consistency."
    ],
    "decisionsMade": [
      "Beta launch date is set for March 15."
    ],
    "actionItems": [
      { "task": "Draft the updated messaging doc", "owner": "Priya" },
      { "task": "Follow up with legal on the contract redline", "owner": "Unassigned" }
    ]
  }
}
```
- Each of `keyDiscussionPoints`, `decisionsMade`, `actionItems` is always present, even if empty (`[]`) — the frontend renders an explicit "None identified" state for an empty array rather than treating it as missing data (per PRD F2-AC3).
- `actionItems[].owner` is the exact name as mentioned in the source text, or the literal string `"Unassigned"` when no owner is stated — never omitted, never guessed.

This shape is enforced server-side via the Claude API's structured-outputs feature (`output_config.format` with a `json_schema` matching the `Summary` interface in §3, `additionalProperties: false`), so the backend does not need to parse or validate free-text model output — a schema mismatch would itself surface as an upstream API error (handled below), not a malformed 200.

### Error response — shared envelope
```json
{
  "error": {
    "code": "EMPTY_INPUT | SUMMARIZATION_FAILED | TIMEOUT",
    "message": "Human-readable message safe to display in the UI"
  }
}
```

| Scenario | HTTP status | `error.code` | Cause / handling |
|---|---|---|---|
| Empty or whitespace-only `transcript` | `400 Bad Request` | `EMPTY_INPUT` | Validated at the top of the route handler before calling Claude — no API call is made. |
| Claude API call fails (auth error, rate limit, 5xx, malformed response) | `502 Bad Gateway` | `SUMMARIZATION_FAILED` | Caught around the `claudeClient` call; the specific upstream error is logged server-side (not exposed to the client) and a generic message is returned. |
| Claude API call exceeds the configured client timeout | `504 Gateway Timeout` | `TIMEOUT` | The Anthropic SDK client is constructed with an explicit request timeout (e.g. 30s); a timed-out request throws `APIConnectionTimeoutError`, caught separately from other API errors so the UI can say "this is taking too long" rather than a generic failure. |

On any error response, the frontend keeps the user's pasted text in the textarea (per PRD F5-AC2) — this is a frontend behavior, not something the API needs to echo back.

---

## 5. Implementation Sequence

Ordered for the 3-hour build; each step produces something runnable before moving to the next.

1. **Scaffold** — `npm create vite@latest client -- --template react-ts`; a sibling `server/` with a minimal Express app (`app.listen`, no routes yet). Wire an npm script that runs both in dev (`concurrently` or two terminals) and a `build` script that runs `vite build` then starts Express pointed at `client/dist`.
2. **Backend: `/api/summarize` happy path** — `services/claudeClient.ts` (Anthropic SDK client, `output_config.format` JSON schema, the summarization prompt) + `routes/summarize.ts` wired to it. Test with `curl` before touching the frontend.
3. **Backend: error handling** — add the empty-input check, the try/catch around the Claude call distinguishing timeout vs. other failures, and the shared error envelope from §4.
4. **Frontend: input → summarize → render** — `InputPanel` (textarea + button + loading spinner), `lib/api.ts` (fetch wrapper), `SummaryView` (three sections, "None identified" empty states). Wire it end-to-end against the real backend.
5. **Frontend: persistence & history** — `lib/storage.ts` (versioned `localStorage` read/write), auto-save on successful summarize, `HistoryList` + click-to-reopen + delete-with-confirmation.
6. **Frontend: error UI** — `ErrorBanner` wired to the three error codes from §4, input preserved on failure.
7. **Deploy** — push to Railway or Render as a single Node service; set `ANTHROPIC_API_KEY` as a platform environment variable; confirm the build command runs `vite build` before `node server/index.js` starts.

Nice-to-haves from the PRD (copy/export, editable output, search) are explicitly out of this sequence — only pick them up if time remains after step 7.

---

## 6. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| **Claude API latency or timeout** on long transcripts | User sees a stuck "Summarizing…" state or a failed request | Explicit client-side request timeout (§4) mapped to a distinct `TIMEOUT` error code; loading state always resolves to either success or a visible error, never hangs silently. |
| **Model output doesn't match the 3-section shape** | Broken UI rendering, or silently wrong action-item owners | Mitigated structurally via Claude's structured-outputs (`output_config.format`) rather than prompt-only instructions — a schema violation fails the API call cleanly (surfaces as `SUMMARIZATION_FAILED`) instead of producing malformed JSON the frontend has to guess at. |
| **Unbounded input size** drives up latency/cost or approaches context limits | Slow or failing requests on very long transcripts; no cost guardrail | No cap enforced in v1 (PRD open question) — the Claude API's own context window is the ceiling. Flagged here as the first thing to add if real usage shows long transcripts are common. |
| **API key exposure** | Leaked credential if the key ever reached the frontend bundle | The key is only ever read server-side (`process.env.ANTHROPIC_API_KEY` inside `services/claudeClient.ts`); the frontend has no knowledge of it and calls only the same-origin `/api/summarize` path. |
| **Single Express process is a single point of failure** | If the process crashes, both the API and the static frontend go down together | Acceptable for a single-user tool at this scope; Railway/Render both auto-restart a crashed process. Not worth a separate frontend host for the reliability gain it would buy. |
| **`localStorage` data loss on quota exceeded or browser data clearing** | Saved summary history disappears | Out of scope for v1 (PRD explicitly excludes this as a hard guarantee) — noted here so it's a known, not a surprise, limitation. |
