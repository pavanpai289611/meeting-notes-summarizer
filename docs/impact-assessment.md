# Impact Assessment — Stakeholder Change Request

Assessed against: `docs/vibe-coding-spec.md`, `client/src/**`, `server/**`, and `docs/product-brief-and-prd.md`.

Stakeholders requested three changes after reviewing the initial version. For each, this assessment determines whether it's already satisfied by existing work or genuinely new.

---

## 1. "User-facing error messages that are clear and actionable, no technical jargon visible to users"

**Verdict: Already satisfied.**

- `client/src/lib/api.ts` exports `getErrorMessage(error: unknown): string` (built in **Task 5**, `docs/vibe-coding-spec.md` §6), which maps every known failure to a distinct, plain-language message:
  - `EMPTY_INPUT` → "Please paste some meeting notes before summarizing."
  - `TIMEOUT` → "Summarization is taking too long. Please try again in a moment."
  - `SUMMARIZATION_FAILED` → "Something went wrong generating the summary. Please try again."
  - Any unrecognized `ApiError` code → generic "Something went wrong. Please try again."
  - Any non-`ApiError` failure (e.g. the network itself is unreachable) → "Couldn't reach the server. Check your connection and try again."
  - The function has no path that returns a raw `error.message`, stack trace, or backend implementation detail.
- `App.tsx`'s `handleSubmit` catch block always routes through `getErrorMessage(error)` before setting `errorMessage` state — there's no code path in the app that sets `errorMessage` from anything else.
- `ErrorBanner.tsx` renders this in a visually distinct way (red border/background, "Error:" prefix) rather than plain text.
- This was forced-tested for all three real backend error codes (invalid API key → `SUMMARIZATION_FAILED`, 1ms timeout → `TIMEOUT`, empty input → `EMPTY_INPUT`), confirmed via real browser screenshots, not just code review.

**Minor gap worth flagging (not what stakeholders likely meant, but real):** there is no React error boundary. An *uncaught* rendering exception (not a summarize-request failure) would still show React's/the browser's default error behavior, not our `ErrorBanner`. This is outside what Task 5 was scoped to solve and wasn't called out in the PRD; flagging for completeness, not recommending action unless stakeholders confirm they mean this broader case.

---

## 2. "Mobile-responsive layout on at least 2 key screens"

**Verdict: Genuinely new work — and it directly reverses an explicit PRD decision.**

- `docs/product-brief-and-prd.md` §2.6 (Out-of-Scope v1), item 8: **"Mobile-optimized/responsive design polish beyond basic usability."** This was a deliberate scope exclusion in the accepted PRD, not an oversight — the current codebase not having this is by design, not a bug.
- `client/src/App.css` has zero media queries, no breakpoints, no mobile-specific rules anywhere in the stylesheet.
- What *does* exist, incidentally (not because of intentional mobile work): `.app` uses `max-width: 720px; margin: 0 auto;` (fluid, not a fixed px width) and `.input-panel textarea { width: 100% }` — these happen to not be actively hostile to narrow viewports, but nothing has been tested at mobile widths.
- Concrete risk spots for a narrow viewport, found by reading the actual CSS/markup:
  - The `<h1>` ("Meeting Notes Summarizer") has no font-size override — it renders at the browser's large default `h1` size (visibly oversized even at desktop widths in earlier screenshots), which will be worse on a ~375px phone screen.
  - `.history-list li` is `display: flex` with no `flex-wrap` — the timestamp, snippet, and Delete button are laid out in a single row with no defined narrow-screen behavior.
  - `client/index.html` does have the standard `<meta name="viewport" content="width=device-width, initial-scale=1.0">` tag (Vite's default) — the one prerequisite for responsive CSS to work at all is present, so this isn't starting from zero.
- This is real, net-new frontend work: needs a scope decision from stakeholders/PM (which 2 screens — likely the main input/summary view and the history view, i.e. the same single page's two states) and CSS work with actual breakpoints, plus a PRD update since it reverses an explicit out-of-scope line item.

---

## 3. "Loading states on all data-fetching operations"

**Verdict: Already satisfied — and there's only one such operation to cover.**

- Inventory of every data operation in the app:
  1. `POST /api/summarize` (`lib/api.ts` → `summarize()`) — the only genuine async/network call in the entire app.
  2. `loadRecords()` / `saveRecord()` / `deleteRecord()` (`lib/storage.ts`) — all synchronous `localStorage` reads/writes, not network calls. There's no meaningful "loading" state possible or needed for synchronous, sub-millisecond local operations.
- For #1, the loading state is fully implemented (**Task 3**, hardened in **Task 5**): `App.tsx`'s `isLoading` state wraps the `summarize()` call in `try/finally`, and `InputPanel.tsx` uses it to disable the textarea, disable the button, and swap its label to "Summarizing…" for the duration of the request. This was verified with real browser screenshots showing the loading state mid-request.
- So "all data-fetching operations" trivially resolves to "the one that exists," and it's covered.

**Minor nuance worth flagging (polish, not a gap against the literal ask):** while the request is in flight, the *previous* summary (if any) stays visible in `SummaryView` unchanged — only the button/textarea signal that something is loading. If a user re-summarizes after already having a result on screen, there's no visual treatment (dimming, skeleton, etc.) over the stale result area itself. This is a reasonable follow-up polish item but isn't what "add a loading state" literally requires, since a loading indicator does exist and is accurate.

---

## Summary Table

| # | Request | Verdict | Key reference |
|---|---|---|---|
| 1 | Clear, actionable, jargon-free error messages | **Already satisfied** | Task 5 — `client/src/lib/api.ts` (`getErrorMessage`), `ErrorBanner.tsx` |
| 2 | Mobile-responsive layout, ≥2 screens | **New work — reverses PRD §2.6 item 8** | `client/src/App.css` (no media queries); PRD out-of-scope list |
| 3 | Loading states on all data-fetching ops | **Already satisfied** | Task 3/5 — `App.tsx` `isLoading`, `InputPanel.tsx`; only 1 such operation exists |

**Net new work from this change request:** effectively just item 2 (mobile responsiveness). Items 1 and 3 require no code changes — if stakeholders want to confirm, the fastest path is a live walkthrough of the already-built error states and loading state rather than new development.
