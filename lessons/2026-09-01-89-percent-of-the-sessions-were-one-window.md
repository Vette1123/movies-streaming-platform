# 89% of the sessions were one window

**Date:** 2026-09-01
**Scope:** looking for what to improve after the accessibility and INP sweeps
came back clean — a health pass over Core Web Vitals, error tracking, PostHog
ingestion and the Cloudflare quotas.

## What

Three of the four came back green and the fourth explained why one of them had
looked red for months.

**Core Web Vitals, real users, mobile, 14 days:** LCP 1556ms, FCP 850ms, CLS
0.047, INP 192ms. All four inside Google's bars. **Error tracking:** one issue
in 14 days, a single `insertBefore` `DOMException` — the Google-Translate DOM
race, not ours.

**Desktop vitals said LCP 2496ms and FCP 5197ms**, which is impossible: FCP
cannot follow LCP. Split by viewport, 39,826 of 41,792 desktop samples came
from windows measuring exactly 1280×720, reporting **no LCP at all** and an FCP
of 5.2 seconds.

That cohort, over 30 days:

|               | sessions | pageviews | autocapture | searches | plays |
| ------------- | -------- | --------- | ----------- | -------- | ----- |
| 1280×720      | 89,555   | 99,459    | **28**      | **15**   | **8** |
| everyone else | 10,976   | 24,707    | 22,935      | 5,325    | 7,099 |

**89% of all sessions and 63% of everything ingested** is one residential-proxy
scraper fleet: 1.11 pageviews per session, a rotating user agent
(Chrome/Edge/Firefox × Windows/Mac, always `en-US`), and effectively zero
interaction. `analyticsEnabled()` — already the single gate for dev traffic —
now drops it too.

`pnpm cf:health`: **invocations at 89% of the free plan's 100k/day.** 69% of
them are tail-id detail pages and another 25% is the payload those same pages
fetch once they boot. That one is a decision, not a fix; it is written up below.

## Mistakes

**Read a metric before checking who produced it.** Desktop LCP 2496ms sat one
step from the "needs improvement" line and desktop FCP 5197ms is a failure by
any standard. Both are artefacts of a population that does not paint. The tell
was in the same row the whole time — a **null LCP** on 39,826 samples. A
percentile over a population you have not looked at is a number, not a fact.

**Nearly built a fingerprint before checking whether the simple one was
already precise.** The first draft added `outerHeight === innerHeight` (no
browser chrome) on top of the viewport match. It is a good signal, but it can
only ever reduce false positives — and the viewport match alone already yields
28 interaction events in 99,459 pageviews. The extra clause could not improve
precision measurably and could silently break the whole filter if the fleet's
headless build reports outer dimensions differently. Dropped it.

**Two performance "wins" I did not ship.** The `image_host_fallback` event is
99.4% this fleet failing to fetch images — an alarm for an ImageKit outage that
is not happening. It is now silent because the fleet never inits PostHog at all,
which is better than sampling the event down: the fix was upstream of it.

## What worked

**The gate was already built.** `analyticsEnabled()` in `lib/posthog-client.ts`
existed because dev sessions had once buried the error dashboard, and every
`ph()` call site plus the provider already route through it. Bot traffic is the
same shape of problem — "this is not a visitor" — so it is the same guard, one
clause longer. No new module, no per-call-site opt-out to forget.

**Dropping beats filtering.** Events never sent cost no ingestion, create no
person profile (`$set` was 108,357 events, 84% of it this fleet), and cannot be
forgotten by a dashboard that omits the filter. Cloudflare already counts this
traffic accurately; PostHog is for questions about people.

**Four queries, not four hours.** Vitals by device, then by viewport, then the
cohort's engagement, then event volume by name. Each one narrowed the next.

## The open decision: invocations at 89% of cap

Not a defect and not fixable from the code without giving something up. Last 24
hours, 88,611 invocations against a 100,000/day free-plan cap:

| route                     | share | what it is                                                |
| ------------------------- | ----- | --------------------------------------------------------- |
| `/movies/` + `/tv-shows/` | 69.3% | tail-id fallback: a detail id outside the prerendered set |
| `/api/media/`             | 24.9% | the payload the fallback shell fetches once it boots      |
| everything else           | 5.8%  | filters, seasons, sync, auth, billing                     |

So ~94% of the budget is crawlers walking the id space, and each of those pages
that runs JS costs two invocations rather than one. The options all trade
something:

- **Inline the payload into the fallback HTML** — removes 25% of invocations,
  but puts the 98KB `append_to_response` fetch back on the Worker, which is
  exactly what `services/media-summary.ts` was written to get off it. CPU p99
  is already 8ms against a 10ms budget. Trading the metric with zero kills for
  the metric that is 11% from a hard stop is the wrong direction.
- **Stop advertising off-set ids** — the sitemap harvests ~14,900 URLs from
  similar/recommended anchors deliberately, because Bing was landing on pages
  the sitemap did not list. This is the SEO strategy, working as designed.
- **Tighten the WAF** — the free plan takes five custom rules and all five are
  in use.
- **Workers paid, $5/month** — 10M requests, cap gone, nothing else changes.

The fourth is the honest answer. Every constraint in this repo's architecture
exists to stay inside the free plan; this is the first one that cannot be
engineered around without spending SEO or CPU to buy it.

## Rules

- **Check the population before believing the percentile.** Split by viewport,
  device and engagement first. An impossible ordering (FCP after LCP) or a null
  in a metric that cannot be null means you are measuring something that is not
  a person.
- **Filter bot traffic at the capture gate, not in the dashboard.** A dashboard
  filter is something every future query has to remember.
- **A fingerprint is a measurement with an expiry date.** Write the numbers it
  was derived from into the comment beside it, so the next person can tell
  whether it still holds.
- **Do not add a clause to a heuristic that is already precise enough.** Every
  extra condition is another way for it to stop matching.
- **When the answer is "pay for the plan", say so.** Engineering around a quota
  has a cost too, and here it is measured in indexed pages and CPU headroom.

## Related

- [`2026-09-01-inp-was-already-fixed.md`](2026-09-01-inp-was-already-fixed.md)
  — the same lesson about trusting a number without its population.
- [`2026-09-01-the-fleet-was-ten-strings.md`](2026-09-01-the-fleet-was-ten-strings.md)
  — the same fleet, seen from the Cloudflare side.
