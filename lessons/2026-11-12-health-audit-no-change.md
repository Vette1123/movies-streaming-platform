# Health audit: PostHog, player, Search Console, Bing — no code change

## What

A full pass on 2026-11-12 found nothing in Reely that needed code:

- **PostHog:** 0 open issues.
  - The "reely" server showed 22 failures in 14 days. All of them predate 2026-11-10, when `no_stream` reached
    `player_failed` (#170), and there were 0 reely-player failures after 11-09.
  - 10 of the 16 dead boots were `hls_details=no_stream`: titles with no stream at all.
  - `vidsrc.sh` stalls (10%) are spread across content and browsers: the provider being slow. The anonymous
    auto-hop (#184) handles them.
- **Mobile INP:**
  - Field p75 fell from 430 ms (11-10) to 86 ms (11-11) after the Watch Now fix.
  - Search Console still lists 74 poor mobile URLs. That is its 28-day window, so check again after ~11-18.
- **GSC 404s:**
  - 58 of the 80 title, person and collection URLs crawled in November are TMDB-deleted ids. TMDB returns 34
    "resource not found" for them, so our 404 is correct, and none are in the sitemap.
  - The other 22 already answer 200, fixed on 11-09.
- **GSC Soft 404:** every one was last crawled before 2026-08.
- **Bing:**
  - The 98 "short meta descriptions" are stale. All 25 sampled pages are 150–160 characters live.
  - Of the 3 "missing in sitemaps", 2 are in the 31,389-URL sitemap. The third is a tail page.
- **`cf:health`:** 0 kills, 25% of the invocation cap, and 1×503 in 178k requests.
  - The 9 daily `400 /api/pro/ticket` responses are bodies with no title. A real page always sends the TMDB title,
    and no `player_failed` matches them, so they come from non-browser callers.

## Mistakes

- The read-only investigator reported that the Pro player "carries no error code" and proposed adding one. The shell
  already sends the reason as `player_incident` with `step=dead_on_boot` and `hls_details=<reason>`. I nearly
  built a field that already exists. Check which version wrote an event before reading a missing property as a bug.

## Rules

- A property that is absent on every event: first check the date it shipped against the events' timestamps.
- Before treating a GSC 404 as a bug, ask TMDB whether the id still exists.
