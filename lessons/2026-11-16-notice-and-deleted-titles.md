# A copyright notice, and titles TMDB deleted

**Date:** 2026-11-16
**Area:** `config/blocked-titles.json`, `data/sitemap-ledger.json`, `scripts/sitemap-ledger.mjs`

## What

- Google forwarded a copyright notice on 15 Nov: `/tv-shows/241002` ("Adam's Sweet Agony"),
  comeso GmbH, reference 5-3562000041642-1240424411, Lumen 103304933. Playback disabled with
  `pnpm takedown`; the page stays. No appeal, no reply, as in the earlier notices.
- The five 10 Nov entries said "not named in the Google notice (Lumen pending)". The emails do
  name the claimant ("Rights holder represented: comeso GmbH"), so all five now say so.
- GSC "Some fixes failed" for reely's "Not found (404)": 834 URLs (from 2.3k). All sampled
  ones are real 404s: four `/movies/<id>` ids TMDB itself deleted, plus old `/m/<freebase>` and
  `/en/<slug>` paths Reely never had. One of the deleted ids, `/movies/1821659`, was still in
  `sitemaps/movies.xml`, because the ledger only ever adds.
- The ledger now has `gone` (never listed, never re-added) and a rotating TMDB probe:
  `pnpm sitemap:ledger --probe 1500` in the daily Ratings job. Only a 404 marks an id gone; any
  other answer keeps it, and more than 20% of a slice gone aborts with nothing dropped.
- The high-id tail (ids above 1.2M movies / 200k TV, 9,275 ids) was probed once by hand: 0
  errors, 12 gone (11 movies incl. 1821659, TV 313078), 0.13%; two spot-checked 404 on the site.

## Mistakes

- The ledger's "never drop" rule had no exit for a title that stops existing. It fixed Bing's
  "missing from sitemaps" and created GSC 404s for the same reason: a set that only grows.
- The rule said to copy the claimant from Lumen weeks later. It was in the email the whole time,
  in the "Details of Original Claim" block below the URL.

## What worked

- One `innerText` regex over each open Gmail message (URL, reference, Lumen id, claimant, work)
  instead of reading by eye; it showed eight of the nine were already blocked in seconds.

## Rules

- Read "Rights holder represented" from the notice email itself; never write "not named".
- Any append-only URL set needs a removal path for things that cease to exist upstream, with an
  error-tolerant check (only an explicit 404 removes) and a sanity cap.
- A GSC 404 validation "fails" while any old URL still 404s. A 404 for a page that doesn't exist
  is correct; only a 404 the site itself advertises is a bug.
