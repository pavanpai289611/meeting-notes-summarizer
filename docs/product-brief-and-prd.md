# Meeting Notes Summarizer — Idea Brief & PRD

## 1. Idea Brief

**Problem.** People leave meetings with messy raw notes or auto-generated transcripts and no quick way to extract what actually matters — what was discussed, what was decided, and who owes what. Manually re-reading and organizing this takes 10–15 minutes per meeting and is often skipped, so decisions and action items get lost.

**Target user.** An individual professional (the user themself, initially) who takes or receives raw meeting notes/transcripts and wants a fast, private, no-setup way to turn them into something scannable — no team rollout, no login, no shared backend.

**Value prop.** Paste your notes, get a clean structured summary (key points, decisions, action items with owners) in seconds — nothing to install, nothing to sign into, nothing leaves your browser except the one API call to summarize.

**MVP scope (3-hour build).**
- Single-page app: large textarea input → "Summarize" button → structured output (Key Discussion Points / Decisions / Action Items with Owner if mentioned).
- One LLM call (Claude API) via a thin Node/Express backend that holds the API key server-side.
- Summaries auto-saved to `localStorage`; a simple list/history view to reopen past summaries.
- No auth, no database, no multi-user support.

**Top 3 risks.**
1. **Extraction accuracy on messy input** — real transcripts are unstructured/rambling; the model may miss or hallucinate owners/decisions, undermining trust in the tool's core value.
2. **Scope creep in a 3-hour window** — history/search/export/editing features are easy to start and hard to cut off; going past must-haves risks shipping nothing working.
3. **Unbounded input size / cost** — pasted transcripts can be very long, risking slow responses, high token cost, or hitting model context limits with no guardrail in place.

**Biggest assumption.** Users will trust and act on the model's automatically-extracted decisions/owners without needing to edit or correct the output — i.e., "good enough" single-pass extraction is usable as-is for a first version, without an editing/correction loop.

---

## 2. PRD

### 2.1 Problem
Raw meeting notes and transcripts are unstructured and time-consuming to review. Key outcomes (decisions, owners, action items) are buried in noise, so they're frequently lost or require manual re-reading to recover. There is no existing lightweight, private, zero-setup tool for this — existing options are either full note-taking apps (heavyweight, require accounts) or manual copy-paste into a general chatbot (no structure guarantee, no persistence).

### 2.2 Users
- **Primary:** A single individual (the builder/user) who attends or receives meeting notes and wants a fast recap tool for personal use.
- Not in scope for v1: teams, shared workspaces, multiple concurrent users, or any admin/viewer role distinction.

### 2.3 User Stories
1. As a user, I want to paste raw meeting notes/transcript text into a box so that I can get a summary without formatting it myself first.
2. As a user, I want to click one button and get back key discussion points, decisions, and action items (with owners when mentioned) so I can scan a meeting's outcome quickly.
3. As a user, I want my past summaries saved automatically so I can revisit them later without re-pasting or re-running the summary.
4. As a user, I want to see a list of my previous summaries (e.g., by date/title) so I can find a specific one again.
5. As a user, I want to delete a saved summary so my local history doesn't get cluttered with junk/test runs.
6. As a user, I want clear feedback if the summarization fails (e.g., empty input, API error) so I know to retry rather than assume it's broken.

### 2.4 Features

#### Must-haves (with acceptance criteria)

**F1 — Paste & Summarize input**
- AC1: A textarea accepts multi-line pasted text of at least 20,000 characters.
- AC2: A "Summarize" button is disabled when the textarea is empty/whitespace-only.
- AC3: Clicking "Summarize" sends the text to the backend and shows a visible loading state until a response returns.

**F2 — Structured summary output**
- AC1: Output renders three distinct sections in this order: "Key Discussion Points," "Decisions Made," "Action Items."
- AC2: Each action item shows the task text and, if an owner was mentioned in the source text, the owner's name next to it; if no owner is mentioned, it's labeled "Unassigned" rather than omitted or guessed.
- AC3: If the model returns no items for a section (e.g., no decisions were made), that section renders an explicit "None identified" state rather than being blank or missing.

**F3 — Local persistence (localStorage)**
- AC1: On a successful summarization, the input text, structured output, and a timestamp are saved to `localStorage` automatically, with no extra save action required.
- AC2: Reloading the page (browser refresh) still shows previously saved summaries.
- AC3: Storage uses a versioned schema/key (e.g., `mns:v1:summaries`) so a future format change doesn't crash on old data.

**F4 — History list**
- AC1: A list view shows all saved summaries, most recent first, each with a timestamp and a short title/snippet derived from the content.
- AC2: Clicking an entry loads its full structured output (and original input) into view.
- AC3: Each entry has a delete control that removes it from `localStorage` immediately, with a confirmation step before deletion.

**F5 — Error handling for summarization failures**
- AC1: If the backend/API call fails (network error, API error, timeout), the UI shows a distinct, human-readable error message (not a raw stack trace or silent failure).
- AC2: The user's pasted input is preserved in the textarea after a failure so they don't have to re-paste to retry.

#### Nice-to-haves (explicitly not must-have; build only if time remains)
- Copy-to-clipboard / export summary as Markdown or plain text.
- Editable output (correct a misidentified owner/decision before saving).
- Basic client-side search/filter across saved summary history.

### 2.5 Non-Functional Requirements
- **Performance:** Summarization of a ~5,000-word transcript should return within ~15 seconds under normal conditions (bounded mainly by the Claude API's latency, not the app).
- **Reliability:** A single failed API call must not corrupt or wipe existing `localStorage` data.
- **Privacy:** No pasted content or generated summary is sent anywhere except the one backend call to the LLM API for summarization; nothing is logged or stored server-side.
- **Portability:** Deployed to a live URL (Railway/Render) rather than run locally only, without requiring account creation, sign-in, or a hosted database.
- **Browser support:** Latest stable Chrome/Edge/Firefox/Safari — no legacy browser support required (single user, known environment).
- **Secrets handling:** The Claude API key is set as a platform environment variable in production (Railway/Render), never sent to or exposed in the frontend bundle.

### 2.6 Out-of-Scope (v1)
1. User accounts, authentication, or multi-user support.
2. A backend database (Postgres/Mongo/etc.) — persistence is `localStorage` only.
3. Audio/video transcription (the tool consumes already-transcribed/typed text, not recordings).
4. Team/shared workspaces, sharing a summary via link, or collaboration features.
5. Editing/correcting the generated summary output before saving.
6. Export/integration with third-party tools (Slack, email, calendar, Notion, Jira, etc.).
7. Summary quality analytics, feedback loops, or fine-tuning based on usage.
8. ~~Mobile-optimized/responsive design polish beyond basic usability.~~ **Reversed in Sprint 2:** basic mobile-responsive layout for the input/summarize screen and the history screen was added per stakeholder change request (see `docs/impact-assessment.md`) — a capped header size and a stacked history-item layout at narrow widths. Deeper mobile polish beyond these two screens remains out of scope.
9. Rate limiting, billing/usage caps, or cost dashboards for API usage.

### 2.7 Success Metrics
Given this is a personal single-user tool, "success" is adoption-of-habit and trust, not growth metrics:
- The user actually uses it after a real meeting within the first week of it being built (dogfooding signal), rather than reverting to manual note review.
- ≥80% of generated action items correctly capture an owner when one was explicitly stated in the source text (spot-checked manually across a handful of real transcripts).
- Zero data-loss incidents in `localStorage` (a saved summary is never silently lost on reload).
- End-to-end summarize action (paste → structured output) completes in under ~15 seconds for a typical meeting-length transcript.

### 2.8 Open Questions
1. What's the expected max input length in practice — a 15-minute standup transcript, or a 2-hour workshop? This affects whether chunking/truncation is needed for v1 or can be deferred.
2. Should the backend enforce an input character cap (and how should the UI communicate that limit) to protect against excessive API cost/latency, or is that a nice-to-have guardrail for later?
3. Is there a preferred summary "voice"/format beyond the three sections (e.g., bullet length, tone), or is the model's default structured JSON-to-UI rendering sufficient for v1?
4. ~~Will this ever need to run somewhere other than the user's local machine?~~ Resolved: yes — it will be deployed to a live URL (Railway/Render); see Constraints.

### 2.9 Constraints
- **Timebox:** 3 hours total build time — architecture and scope must stay minimal enough to fit.
- **Stack:** React (frontend), Node/Express (backend), Claude API for summarization (per repo README) — no deviation to keep the build within scope.
- **Deployment:** Deployed to a live URL on Railway or Render, not run locally only. The Claude API key is set as a platform environment variable in production, not committed or bundled into the frontend.
- **No database:** Persistence must use browser `localStorage` only.
- **Single user, no auth:** No login flow, session handling, or per-user data isolation required.
- **API key security:** The backend must proxy the Claude API call so the key is never exposed to the browser/client bundle.
