# Tail pages preload their payload

## What

Search Console flagged 71 mobile URLs for LCP > 2.5s. PostHog `$web_vitals` (28 days, mobile, `/movies/:id`) split them cleanly: Worker tail ids p75 3,636 ms (n=106), prerendered ids p75 1,056 ms (n=12). A tail page's text only exists after JS downloads, hydrates and then fetches `/api/media/<type>/<id>`, so the fetch sat behind the whole bundle. The Worker now writes `<link rel="preload" as="fetch" crossorigin="anonymous">` for the exact path the shell fetches (media and collection fallbacks), so the payload downloads alongside the JS.

## Mistakes

- First instinct was to blame image LCP. The PostHog split by prerendered vs tail id showed it was the text element on tail pages only; measure the split before guessing.
- A preload is only free if it matches the later `fetch()` exactly: same URL and CORS mode (`crossorigin="anonymous"` = a plain same-origin `fetch`). A mismatch downloads the payload twice. The test pins the path against the shell source for that reason.

## What worked

- Checking `performance.getEntriesByType('resource')` under `wrangler dev`: one entry, initiator `link`, at 50 ms, so the fetch reused the preload.

## Rules

- Anything a tail shell fetches on boot is preloaded from the Worker's head block, with the path copied from the shell (pinned by `tests/fallback-preload.test.ts`).
