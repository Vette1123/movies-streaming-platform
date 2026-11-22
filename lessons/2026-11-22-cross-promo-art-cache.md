# Cross-promo art cache

## What

`/apps/*` and `/promo/*` (the other apps' icons and promo art) had no line in
`public/_headers`, so they fell to Cloudflare's asset default, `max-age=0,
must-revalidate`, and every page view re-asked for each one. They now keep a week in
the browser plus a week of stale-while-revalidate, the same as the brand assets.
`tests/static-art-cache.test.ts` pins both lines.

## Mistakes

- The first header probe used HEAD against the apex domain and read nothing. The apex
  301s to `www.`, and the bot challenge answers bare curl with a 403. Probe `www.` with a
  browser user-agent and GET, or a missing header looks like a working one.

## What worked

- Sorting the files by whether they ever change under the same name. Hashed `_next/static`
  gets a year. Unhashed art that an app can redraw gets a week, never a year.

## Rules

- Every folder in `public/` needs a line in `_headers`. A missing one costs a
  conditional request per view, and nothing reports it.
