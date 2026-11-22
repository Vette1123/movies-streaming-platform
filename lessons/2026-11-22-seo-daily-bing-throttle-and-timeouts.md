# SEO daily: Bing throttle, timeout floor, staggered cron, 2026-11-22

## What

- SEO daily failed on 2026-11-21: Bing SubmitFeed answered `400 ThrottleUser` (ErrorCode 4)
  and `ThrottleHost` (ErrorCode 5). One Bing key serves this site and social-media-downloader,
  and both crons fired 4 minutes apart. `submitSitemaps` now reports a throttle as
  `bing: 'throttled'` and `seo-daily` accepts it. The cron moved 3 hours, to
  `37 4,10,16,22 * * *`, between the other site's runs.
- Bing ConnectionTimeout went 27 (11-20) and 48 (11-21) against a week median of 2. Nothing on our
  side matches:
  - The Worker's wall time on 11-20 and 11-21 was p99 ~2 s and p99.9 ~3 s, with 0 errors
    (`workersInvocationsAdaptive` quantiles).
  - `cf:health` showed 0 failed crawler requests.
  - The index holds at 107k.

  `bingSummary` now needs a jump to also exceed 1% of the day's crawl (`BING_JUMP_SHARE`). The
  timeout count still prints as a line.

- Sweep: PostHog board 0 open, GSC read all 4 sitemaps with 0 errors, eyeball 5xx 16 of 138k
  (0.012%, a warning under the 0.05% gate). The apex `reely.space/movies/235704` row in GSC 301s
  to www. The query "reely" sits at position 45, while "reely tv" sits at 5. The brand entity
  change from 11-11 landed during Google's November core update (11-10 to ~11-24), so re-check
  it on 2026-12-01.

## Mistakes

- Spent four probes trying to time pages from this PC. Node fetch, curl and headless Chrome all
  got Cloudflare's 403 or challenge. Free-plan zone analytics has no TTFB fields. The Worker's
  own wall-time quantiles answered it in one query.

## What worked

- Reading the Worker's wall time per day before treating a Bing counter as our outage.

## Rules

- A Bing counter jump is ours only when the Worker or the edge shows it too.
- Time Reely pages through Workers analytics, never from this PC.
