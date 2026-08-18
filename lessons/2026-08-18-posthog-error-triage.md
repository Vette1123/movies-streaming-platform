# PostHog error triage: four issues, one of them ours

**Date:** 2026-08-18

## What

Error Tracking had four active issues. Read them, classified each, fixed the one that was
a code fault and stopped the other three from ever being reported again.

| Issue                                                                        | Verdict                                                                      |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `DOMException: NotFoundError: The object can not be found here.`             | WebKit's wording for the removeChild collision. Extension/translator noise.  |
| `RangeError: Maximum call stack size exceeded.` ×2 (`/support`, `/tv-shows`) | Injected code — every frame names a document URL, none names a file we ship. |
| `Error: [react_query] media fetch failed: 404`                               | Ours: a bad id was retried twice and filed as an exception.                  |

Shipped:

- `lib/error-noise.ts` — the whole drop verdict, lifted out of `providers/posthog-provider.tsx`
  so it is a pure function over an event and can be tested. Adds the WebKit and Firefox
  removeChild wordings, and a general rule: an exception whose stack names files, **none of
  them under `/_next/`**, is not ours.
- `lib/api-client.ts` — `ApiError` carrying the HTTP status, and `getJson` exported. The three
  fallback shells (`media`, `collection`, `list`) each hand-rolled the same four-line fetch;
  they all go through it now.
- `providers/query-provider.tsx` — a 4xx (except 408/429) is not retried and not filed as an
  `$exception`. It still emits the `api_error` product event, so the rate stays measurable.
- `lib/analytics.ts` — the `Error` in `trackApiError` is now built at the call site instead of
  inside the `ph()` callback.

## Mistakes

- **Assumed the RangeError was ours because the frames said `in_app: true`.** PostHog marks a
  frame in-app by origin, and injected code on iOS is attributed to the DOCUMENT url
  (`https://www.reely.space/tv-shows:224:408`) — which looks exactly like our own script. The
  thing that settled it was fetching the page: it is 15 lines long, so there is no line 224,
  and the only inline script it carries is the one-line appearance boot. Curl the artifact
  before believing a stack frame that cannot be symbolicated.
- **Nearly added a `/Maximum call stack size exceeded/` pattern to the noise list.** That would
  have silenced a real infinite loop in our own code forever. The discriminator is _whose
  frames they are_, not what the message says — and writing it that way retired the need for
  a new regex per third-party symptom.
- **Every handled exception in Error Tracking has been fingerprinted at the wrong file.**
  `trackApiError` built its `Error` inside the `ph()` callback, and `ph()` may not run until
  posthog-js finishes loading — so the stack was captured in `lib/posthog-client.ts`, the queue
  that replayed it, not the call site that failed. Every `[react_query] …` issue in the project
  has that same useless top frame. An `Error` records where it is CONSTRUCTED.
- **First attempt to verify the retry change failed silently.** `Page.addScriptToEvaluateOnNewDocument`
  binds to the current target, and `new_tab` makes a different one, so the `fetch` stub was
  never installed and the counter came back `undefined` while the page rendered from the real
  API. Patch `window.fetch` with `js()` _after_ `new_tab` + `wait_for_load`, then drive the UI.
- Guessed `/api/popular` for the browse list's infinite scroll; it is `/api/filter`. Read
  `performance.getEntriesByType('resource')` first instead of guessing the endpoint.

## What worked

- Suppressing rather than resolving the three third-party issues: the fix is client-side, so
  bundles already in the wild keep reporting them until those tabs die.
- Verifying under `pnpm preview`, not `pnpm dev`. There is no `app/api` in this repo at all —
  every `/api/*` route only exists inside the Worker, so a dev server cannot exercise any of
  this. Measured on the real runtime: 404 → **1** request, 500 → **3**, error UI intact
  ("Couldn't load more titles." + Try again), tail-id shell renders with one API call.

## Rules

- An exception with stack frames, none of them under `/_next/`, is not ours — drop it by
  provenance, never by message.
- A stack with no filenames at all is KEPT. Cross-origin "Script error." looks like that, and so
  does a genuine `captureException` in a browser that gave us nothing.
- Build the `Error` where the failure happened, never inside a deferred callback.
- A 4xx from our own API is an answer, not a fault: no retry (each one costs a Worker
  invocation), no `$exception`. 408 and 429 mean "same request, later" — those still retry.
- Client-side error classification lives in one pure module and is tested; it decides whether
  real regressions are visible, and both failure directions are invisible in a browser.
