Entry 1 — Playwright test timeout during first real API call (Task 3)

What happened: The first browser-driven Playwright test run hit a 30-second timeout with no visible outcome while testing the frontend happy path.

Failure pattern: Test assertion racing against inherently variable LLM latency — the default Playwright wait window was tuned for typical UI interactions, not for a request that depends on an external API call whose response time isn't fully predictable (this one coincided with the first real call after the Anthropic balance had just posted, which was slower than subsequent calls).

Recovery: Rather than assuming the app was broken, checked backend logs and ran a manual curl request during the hang — both confirmed the server was healthy and the request eventually completed successfully server-side. This ruled out an actual application bug before touching any code. Retried the test; the next two runs completed cleanly and consistently.

What I'd do differently: Widen the Playwright timeout specifically for the summarize action, rather than relying on the default — LLM-backed UI flows need a longer, deliberate wait window baked into the test itself, not just a retry-and-hope approach.

Entry 2 — Attempted DOM manipulation to force EMPTY_INPUT didn't work (Task 5)

What happened: While forcing the EMPTY_INPUT error path for testing, tried to bypass the UI's disabled-button guard by stripping the disabled attribute directly from the DOM via devtools, expecting the click to then reach handleSubmit.

Failure pattern: Misunderstanding of React's event model — assumed the live DOM attribute controlled click behavior, when React's synthetic event system actually checks its own recorded disabled prop from component render state, not the DOM at the time of the click.

Recovery: Diagnosed why the click still wasn't firing (rather than repeating the same approach), then switched to testing the backend's defense-in-depth directly via curl, bypassing the UI entirely — which was actually the more correct layer to test anyway, since the backend check exists specifically to catch cases beyond what the frontend guards against.

What I'd do differently: Nothing — this was the right call to make once the DOM-manipulation approach failed; it revealed that the backend validation should be tested independently of the frontend's UI guard in the first place.

Entry 3 — Default Express error handling leaked stack traces on malformed/oversized requests (security review)

What happened: During the Phase 7 security review, discovered that malformed JSON and oversized (>100kb) request payloads never reached the app's own route handler — they were rejected by body-parser first, and with no global error-handling middleware in place, fell through to Express's default HTML error response, which included full stack traces and absolute filesystem paths.

Failure pattern: Coverage gap in error handling — every previously-tested error path (EMPTY_INPUT, SUMMARIZATION_FAILED, TIMEOUT) was one the application's own code explicitly handled, but a whole class of errors (malformed/oversized requests, rejected before the route even runs) had never been tested because every real request sent during development happened to be well-formed.

Recovery: Added a global 4-parameter Express error handler at the end of the middleware chain, detecting body-parser's specific error types and mapping them to the same clean JSON error envelope used everywhere else in the app — without relying on NODE_ENV=production to suppress the leak, since that's a platform assumption, not a guarantee. Re-verified against the exact original failing requests, plus re-confirmed all three pre-existing error codes were unaffected by the new global handler.

What I'd do differently: Test error handling at the framework/middleware boundary earlier, not just at the application-code boundary — the three error codes felt like complete coverage because they mapped cleanly to the PRD's acceptance criteria, but the PRD's criteria didn't anticipate errors that never reach the application code at all.
