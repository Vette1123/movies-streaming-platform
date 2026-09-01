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

**Wrote up a $5/month recommendation off a 24-hour average.** The invocation
number was real; the window was not. `cf:health` defaults to 24h, the WAF change
had landed a few hours earlier, and an average over the broken state reads as a
live failure for a full day after the fix. Three hours of the same query said
34%. **Re-measure with a short window right after any change**, and be suspicious
of a metric whose default window is longer than the age of the fix.

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

## The invocation alarm was a stale window

`pnpm cf:health` graded **88,611 invocations/day, 89% of the free plan's
100,000**, and I spent a while costing out the ways to buy headroom: inline the
payload into the fallback shell (trades CPU, which is 11% from a hard stop, for
invocations), stop advertising off-set ids (trades the SEO strategy), tighten
the WAF (five rules, five in use), or move to Workers paid at $5/month.

None of it was needed. That 24-hour window **straddled a WAF deploy from
earlier the same day** — the ten frozen scraper user-agents had been escalated
from `managed_challenge` to `block`. Re-measured over the three hours after it:
**34,024/day projected, 34% of cap**, kills 0. Verified live: all ten strings
get a 403 on `/movies/<tail id>` and `/api/media/*`, a current Chrome/146 gets 200.

The shape of the problem, while it lasted, is still worth keeping. Of 87,258
invocations: `/movies/` 47.3%, `/tv-shows/` 22.0%, `/api/media/` 24.9%. That is
69% tail-id fallbacks plus the payload those same shells fetch once they boot —
**a crawler that runs JS costs two invocations, not one.** If it comes back,
that ratio is the thing to attack.

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
