# PostHog scripts read the cache, not live data

## What

`scripts/lib/posthog.mjs` `runNode` sent `refresh: 'async'`. PostHog treats that as "a cached
result is fine", so `posthog:query`, `posthog:usage` and `posthog:setup --check` could return
rows hours old. Now it sends `refresh: 'force_async'`, pinned by a test in
`tests/posthog-scripts.test.ts`.

## Mistakes

- The scripts' numbers were trusted because they came from a script and not the UI. A
  query run right after a deploy showed nothing, and that was read as "no events yet"
  when it was really an old cached answer. Found while porting the scripts to the portfolio.

## What worked

- Stubbing `fetch` and asserting the request body. Red with `'async'`, green with `'force_async'`.

## Rules

- Any script that reads PostHog to make a decision sends `refresh: 'force_async'`.
- A fresh event can take ~60 s to become queryable even with a live query. Wait that long
  before reading "nothing arrived" as a fact.
