# seo:pending

## What

`pnpm seo:pending` (same script in Reely and social-media-downloader) inspects the next 60
sitemap URLs through the URL Inspection API, lists what Google hasn't indexed, and picks up to
10 a day for Request Indexing. `--requested <url>…` logs them so they're skipped for 14 days.
The ledger is `scripts/seo-pending-ledger.json` (committed). Indexed URLs are rechecked after
30 days, not-indexed ones after 3. The pure logic lives in `scripts/lib/seo-pending.mjs`.

First runs, 2026-11-23:

- Reely: 120 of 62,392 inspected; 72 indexed, 28 crawled but not indexed, 19 unknown to Google.
  The unknown ones include `/mood`, `/watch-together`, `/press` and `/advertise`.
- Downloader: all 95 inspected; 91 indexed. Not indexed: `/telegram-downloader` and
  `/id/telegram-downloader` (unknown), `/es` and `/pt/dailymotion-downloader` (crawled).

## Mistakes

- Sitemap order is alphabetical, so the first Reely run picked 10 collection pages ahead of
  every section page and title. `rankUrls` now puts top-level pages first, then
  `/movies/` and `/tv-shows/`, then the rest.
- Request Indexing showed "Quota exceeded" on both properties: the account's daily allowance
  was spent earlier in the day. Nothing was logged as requested, so the picks return tomorrow.
  Log only what Search Console confirmed as "Indexing requested".
- 2026-11-24: "Quota exceeded" again, at 14:15 and 14:50 UTC, with nothing logged as requested
  on either day. The allowance is per Google account and also spent from other properties
  and the owner's own clicks, so a "Quota exceeded" on the first pick is not this repo's bug.
  Leave the picks for the next day; never log them.
- Search Console's `/search-console/inspect?…` deep link 404s when opened cold. Open the
  property overview and type the URL into the inspect bar.
- One downloader run died on a 10 s connect timeout fetching the live sitemap. A rerun passed.

## What worked

- The URL Inspection API with the service account `seo:daily` already uses, so no new
  credential was needed.

## Rules

- Run `pnpm seo:pending` daily, work the picks in Search Console, then run `--requested`
  with only the confirmed URLs and commit the ledger.
