# Security Review — `server/routes/summarize.ts` & `server/services/claudeClient.ts`

### Finding 1 (real, empirically confirmed) — Unhandled body-parser errors leak server internals

Malformed JSON and oversized payloads (>100kb, Express's default `express.json()` limit — no explicit `limit` is set) never reach our route handler at all; they're rejected by `body-parser` *before* `routes/summarize.ts` runs. There's no global error-handling middleware anywhere in `server/app.ts`, so both cases fall through to **Express's default HTML error handler**, which I confirmed by actually sending both:

- Malformed JSON → `400`, HTML page with a **full stack trace and absolute filesystem paths** (`/Users/.../node_modules/body-parser/lib/types/json.js:96`, etc.)
- 150KB payload → `413`, same thing — full stack trace, absolute paths, confirms internal library versions/structure (`raw-body`, `body-parser`, Express internals).

This bypasses our own `{ error: { code, message } }` design entirely and directly violates the spirit of PRD F5-AC1 ("not a raw stack trace") for this one edge case — it just doesn't happen to be a case that specific AC's wording (backend/API call failures) was written to cover. It's low severity in this single-user context (no secrets or other users' data leak — just directory layout and library fingerprinting), but it's real, reproducible, and anonymous (no auth needed to trigger it). This did **not** show up in any prior testing because every request I ever sent was well-formed and under the size limit.

**Not fixed** — would need either a global Express error-handling middleware (`app.use((err, req, res, next) => {...})`) mapping body-parser errors to the same JSON envelope, and/or setting `NODE_ENV=production` (which suppresses Express's default stack-trace output) — the latter isn't something this repo's own code currently guarantees; it'd be relying on the hosting platform to set it, which I haven't verified for Render specifically.

### Finding 2 — API key exposure: clean, confirmed on all three vectors

- **Response body:** `grep`'d `server/routes/summarize.ts` — every client-facing error message is a **hardcoded literal string** (`"Please paste some meeting notes before summarizing."`, etc.), never interpolated from the caught `error` object. This structurally guarantees nothing from the Anthropic SDK's exception (which could theoretically carry request/response details) ever reaches the response.
- **Logs:** `console.error("...", error)` logs the SDK's error object, not the `Anthropic` client instance or the key itself. Anthropic SDK errors carry `status`/`headers`/`error` from the *response*, not an echo of the outgoing request or its `x-api-key` header — the key is never in a position to be logged this way. (Based on reading the SDK's error class shapes, not a live packet capture — reasonable confidence, not absolute certainty.)
- **Frontend:** `grep -rn "ANTHROPIC" client/src/` → zero matches. The key is read only inside `getClient()` in `claudeClient.ts`, lazily, server-side only.

No gap found here.

### Finding 3 — "Injection" into the Claude call: no code-level injection vector; one inherent, low-risk LLM consideration

- `transcript` is passed as the literal `content` of a `user`-role message; the system instructions live in a separate `system` parameter, not string-concatenated with user input into one blob. No `eval`, no shell/file/SQL operations touch `transcript` anywhere — there's no database, no filesystem write, no subprocess in this codebase, so classic injection classes (SQLi, command injection, path traversal) don't apply.
- The one real, inherent consideration: structured outputs (`output_config.format`) constrain the *shape* of the response but can't stop adversarial text embedded in a pasted transcript from semantically steering the model's output within that shape (classic "prompt injection via document content"). In a multi-tenant or tool-using agent this would be a serious concern; here, the user is summarizing their own pasted text with no tool access and no other users' data in scope — the realistic blast radius is a user fooling their own summary, not a cross-user attack. Noting this for completeness, not flagging it as something requiring a fix at this project's scope.

### Finding 4 — Input validation: correct for the case it's designed for, unbounded above that

- The `EMPTY_INPUT` check (`typeof transcript !== "string" || transcript.trim().length === 0`) correctly rejects non-strings, empty, and whitespace-only input — confirmed working in prior testing.
- No explicit upper bound on `transcript` length in application code — the only real ceiling is Express's default 100kb body limit, which (per Finding 1) fails ungracefully rather than with our clean error envelope.

### Summary

| # | Finding | Severity | Status |
|---|---|---|---|
| 1 | Unhandled body-parser errors (malformed JSON, oversized payload) leak stack traces + absolute paths | Low–Moderate (info disclosure, no secrets) | **Real, confirmed, not fixed** |
| 2 | API key exposure (response/logs/frontend) | — | **No gap found** |
| 3 | Injection risk in Claude call construction | — | **No code-level gap; one inherent LLM-level consideration noted, low risk at this scope** |
| 4 | Input validation | — | **Correct for the designed case; unbounded-length gap is really Finding 1's root cause** |

---

## Resolution

**Finding 1 has been fixed.**

A global, 4-parameter Express error handler was added at the very end of `server/app.ts`,
registered after every other route/middleware — including the SPA catch-all — since Express
only recognizes a 4-parameter function as an error handler, and it only catches errors from
middleware/routes registered *before* it.

The handler:

- Detects body-parser's error type via `err.type`:
  - `"entity.too.large"` → `413 Payload Too Large`, `{ error: { code: "PAYLOAD_TOO_LARGE", message: "Meeting notes are too long. Please shorten and try again." } }`
  - `"entity.parse.failed"` (with an `instanceof SyntaxError` fallback) → `400 Bad Request`, `{ error: { code: "BAD_REQUEST", message: "Invalid request." } }`
  - Anything else unhandled → `500`, `{ error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." } }`
- Never echoes the underlying error's `message` or `stack` to the client in any branch — the fix does not rely on `NODE_ENV=production` being set by the platform, addressing the exact gap noted in Finding 1's "not fixed" note above.
- Still logs the full error server-side via `console.error` in every branch, so diagnostics aren't lost — only the client-facing response is sanitized.

### Verification performed

- Re-sent the exact malformed-JSON request from the original review → now returns the clean `{"error":{"code":"BAD_REQUEST","message":"Invalid request."}}` at `400`, instead of an HTML page with a stack trace and absolute filesystem paths.
- Re-sent the exact 150KB oversized-payload request from the original review → now returns `{"error":{"code":"PAYLOAD_TOO_LARGE","message":"Meeting notes are too long. Please shorten and try again."}}` at `413`, instead of the same HTML/stack-trace leak.
- Confirmed via the server log that both errors are still captured server-side in full (stack trace, absolute paths) for debugging — only the client response is sanitized.
- Re-confirmed all three pre-existing error codes still work unaffected by the new global handler (i.e., it doesn't accidentally intercept errors that should have been handled earlier): `EMPTY_INPUT` (400), `SUMMARIZATION_FAILED` (502, forced via a temporarily invalid API key, reverted immediately after), `TIMEOUT` (504, forced via a temporary 1ms client timeout, reverted immediately after).
- Re-confirmed the real success path (a real Claude call) still works after all temporary test changes were reverted.
- Ran the full test suite: **8/8 passing**, unaffected by the change.
