# Idea Brief

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
