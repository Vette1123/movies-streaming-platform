# The scraper was paying for the cache

**Date:** 2026-09-02
**Trigger:** `pnpm cf:health` warned `Worker CPU: p50 2.55ms, p99 9.41ms` against an 8ms warn line — "CPU is high again", one day after the WAF block that removed the scraper fleet.

## What

Measured the Worker's CPU in 4-hour buckets across four days, per route, and matched buckets by volume instead of by clock time. Nothing regressed. Two separate things moved, and one of them is the direct cost of yesterday's win.

**1. Average CPU is inversely tied to traffic volume.** Same route, same code, four-hour buckets:

| /movies/ requests in bucket | avg CPU |
| --- | --- |
| 12,677 | 2.13ms |
| 11,500 | 1.88ms |
| 4,961 | 2.16ms |
| 2,008 | 2.24ms |
| 1,432 | 3.19ms |

`/api/media/` says it louder: 1.89ms at 7,157 requests, 3.80ms at 158. Half the per-request cost at forty times the volume.

Two mechanisms, both visible in the report `pnpm cf:cpu` already prints:

- **Cold isolates.** The colo breakdown: colos that saw 1–2 requests averaged 5.00ms, colos that saw 100+ averaged 2.51ms. A cold isolate pays module init on the first request through it. At low volume most colos are cold most of the time.
- **`caches.default` hit rate went to zero.** Subrequests are **1.04 per invocation** over 24h while 84% of invocations are the tail-id fallback — a fallback HIT makes no TMDB call and a MISS makes exactly one, so ~1.04 means almost every request is a MISS. The cache is keyed by URL + build id and the build id changes every 6h on the deploy cron. Spread ~3,000 requests per 4h across every colo and ~14,000 distinct tail ids, and no id repeats inside a colo inside a deploy window. It never repeated on its own before either — **the scraper fleet's enumeration was what made the tail cache pay off.** Blocking it removed the only traffic that hit the same id twice.

Matched-volume check, which is the one that settles it: at ~3,000 requests per 4h the average was 2.20ms on 08-29 and 2.42ms on 08-30, before any of this. It is 2.40ms now. The regime changed, the code did not.

**2. p99 is genuinely ~1.5ms higher, since 2026-08-31.** Comparing buckets of similar volume, `/movies/` p99 went 6–7ms before 08-31 ~10:00 UTC to 8–9ms after. That is the tail-page body work landing: `lib/seo-facts.ts`, `lib/seo-title.ts`, `lib/seo-description.ts` and the extra `HTMLRewriter` injections. It is a real, permanent cost, it bought the Soft-404 fix, and a MISS is what pays it — which is why it only became visible once the hit rate collapsed.

Both together put p99 at 9.41ms. **Kills: 0 of 28,098.** Invocations 28% of cap, subrequests 1.04 of 50. There is nothing to fix.

Two other things the report flagged and neither is ours: the 20–22ms invocations at exactly `:00:17` with no request URL are the hourly cron sweep (scheduled handlers get 30s of CPU, not 10ms), and the Workers dataset holds **zero** 5xx for the day — the 3 eyeball 500s in 173,830 requests never reached the Worker.

## Mistakes

- **Read the gauge and skipped the gate.** The first reaction to `p99 9.41ms` was to look for a regression, when the line directly under it said `Worker kills: 0 of 28098` and the script's own footer says "CPU is a gauge; kills are the gate". Two numbers in the same output, and the alarming one is the one that does not decide anything.
- **Nearly pinned it on the wrong commit.** `cloudflare/worker.js` changed on 09-01 at 10:08 and the average jumped the same day, which reads as cause and effect. It is not: the same-day WAF block moved traffic by 5x, and the bucket table shows the average tracking volume across four days, including two days before that commit existed. The commit that *did* raise p99 landed the day before, on 08-31, and was invisible until the cache stopped hiding it.
- Assumed the 8ms warn line still described the same system. It was calibrated while a scraper fleet was warming every isolate and filling the tail cache for free. That regime is gone.

## What worked

- **Bucketing by volume, not by time.** Four-hour buckets over 96h, then comparing buckets with the same request count instead of adjacent ones. That is what turned "CPU rose yesterday" into "CPU is exactly where it has always been at this volume", in one table.
- **Subrequests per invocation as a cache-hit-rate probe.** `pnpm cf:health` already prints it for a different reason (the 50-subrequest cap). With one route dominating and a known 0-or-1 subrequest cost, that ratio *is* the hit rate, at no extra work.
- The colo-volume breakdown in `pnpm cf:cpu` measures the cold-isolate tax directly. It was written for a different question and answered this one.

## Rules

- **CPU per request is a function of traffic volume.** Never compare a CPU average across a window where the volume changed — match buckets by request count first. Less traffic makes every remaining request more expensive, through cold isolates and through cache misses.
- **A cache hit rate is a property of the traffic, not of the cache.** Repetitive traffic subsidises everything behind it. When you remove a bot, expect the per-request cost of what is left to go up, and do not read that as a regression.
- **`caches.default` on the tail fallback is close to useless now.** ~14,000 ids, a build id that rotates every 6h, and real traffic that does not repeat. Leave it — it costs nothing and still absorbs bursts — but do not size anything on the assumption it hits.
- Kills is the gate, CPU is a gauge. `pnpm cf:health` prints both; read them in that order. See [2026-08-20 worker CPU by route](2026-08-20-worker-cpu-by-route.md).
- A per-request cost added on a MISS-only path can hide for days behind a high hit rate. When one lands, note the p99 at matched volume before the traffic mix moves.
