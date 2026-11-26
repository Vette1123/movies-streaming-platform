# Genre pages name what they list

## What

The 26 Nov sweep: test 1410/1410, lint, typecheck, `seo:verify` 71/71, PostHog 0 open, no
GitHub issues. `seo:pending` had 30 "Crawled - currently not indexed" URLs, four of them genre
pages (`/movies/genre/{animation,drama,western}`, `/tv-shows/genre/western`). Every genre page
carried the same one-line intro ("Popular drama movies, refreshed regularly.") over a grid whose
titles live only in `alt` text, so 35 pages read as one template. `lib/genre-intro.ts` now writes
the intro from the build's own discover payload: the top three titles by name and the size of
the genre. The `CollectionPage` JSON-LD carries the same text. No extra TMDB request.

## Mistakes

- First draft said "Browse all 20,001 drama movies". Animation also said 20,001: TMDB caps
  `total_results`, and discover stops at 500 pages anyway. A count of 10,000 or more now reads
  "thousands of", and smaller ones say "the most popular of TMDB's N", never "all".
- `cf:health` and `cf:cpu` failed with "Unable to authenticate request". The token verified
  `active` (200), and GraphQL answered HTTP 503 code 10001 while cloudflarestatus.com listed
  "Cloudflare Dashboard and Cloudflare API service issues". An HTTP 503 auth error is
  Cloudflare's own outage, not the token. Check the status page before rotating anything.

## What worked

- Reading the live HTML with scripts stripped: visible words per card were "TMDB rating 6.4 ·
  2024", with no title. That named the thinness faster than any report.
- Bing crawl stats per day: Code5xx sits at 39-41 every day (the calibrated baseline from
  [2026-11-21-seo-daily](2026-11-21-seo-daily.md)); the 61 timeouts on 25 Nov are the
  Chrome/131 fleet hours, blocked that morning.

## Rules

- A templated hub page gets text drawn from what it lists, not a fixed sentence.
- Never print a TMDB `total_results` at or above 10,000: it is a cap, not a count.
- Titles and the brand entity stay frozen until the 2026-12-01 core-update re-check.
