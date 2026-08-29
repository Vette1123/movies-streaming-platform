# The fallback event was a bot detector

**Date:** 2026-08-29
**Type:** audit (PostHog health check — no code changed)

## What

Routine "check PostHog for issues, how many visitors yesterday". Two things came out
of it:

1. `image_host_fallback` was firing for 10,234 of 11,049 sessions on 2026-08-28, up
   from ~1/day the week before. It is not an ImageKit outage.
2. Those 11,049 "visitors" are ~316 people. The rest is automated traffic that
   arrived, all at once, starting 2026-08-24.

Left behind: a PostHog action **Human signal** (id 154486 — `$pageleave` or any real
interaction event) and the insight **Real humans vs reported visitors**
(`J6f0qBvc`), pinned to the Reely — Product Analytics dashboard.

## Mistakes

- **Called the fallback a bug before measuring it.** First read of the event breakdown
  was "every visitor hits the image fallback once — either a real bug in the image
  host, or an event firing unconditionally." Both wrong. The event is working exactly
  as designed; what changed was who is visiting.
- **Went looking in the code first.** Grepped the emitter, the circuit breaker, the
  fallback chain, `avifSrcSet`, the `<picture>` source — a full read of machinery that
  had not changed since before the spike. The commit log for 2026-08-24 was full of
  plausible suspects (a large reels/mood/match-night drop landed 2026-08-23), which
  made the code look guiltier than it was. The breakdown that settled it — fallbacks
  by browser — took one query and should have been the first thing run.
- **Trusted a stale memory over the live zone.** Reported that the WAF was still in
  `WAF_PERMISSIVE=1` mode because a memory file said so. It was not: the full ruleset
  had been restored. Checked the CF API only afterwards. A memory that names a
  reversible state needs re-verifying before it is quoted as current.
- **Nearly enabled Bot Fight Mode on request.** Would have broken the two endpoints
  this repo deliberately exempts. Free BFM runs outside the Ruleset Engine — Skip,
  Bypass and Allow have no effect on it, and there is no exception mechanism at all.

## What worked

- **Browser breakdown as the discriminator.** Fallback rate ~64% on Chrome/Firefox/Edge
  and **exactly 0** on Safari, Mobile Safari, Brave, Samsung Internet, Opera. Real
  people use the second group. That one table turned "the CDN is broken" into "the
  clients are fake" in a single query.
- **Probing the host directly instead of reasoning about it.** ImageKit answered 200 on
  a normal URL, on a cold transform (`Miss from cloudfront`, so quota is not exhausted)
  and on an explicit `f-avif`. Three curls closed the outage theory.
- **Counting humans by what a headless client cannot fake.** `$pageleave` needs the tab
  to live long enough to unload; a click event needs a click. 316 of 11,049.
- **Before/after on the same chart.** Through 2026-08-23 the two lines sit within 2% of
  each other — so every number older than 2026-08-24 is still trustworthy, and the real
  audience is growing (≈100/day mid-August → 316 on 2026-08-28).

## Rules

- **A spike in an infrastructure event is a claim about the client, not only about the
  server.** Break it down by browser/device before reading the code that emits it.
- **Probe the third party before blaming it.** One curl to the CDN outranks an hour of
  reading the fallback chain.
- **Never quote a memory about a reversible live setting without re-verifying it.**
  WAF mode, feature flags, quota state — check the API, then speak.
- **Free Bot Fight Mode cannot be excepted.** It does not run on the Ruleset Engine, so
  `/api/billing/bmc` and `/api/calendar/` lose their exemptions the moment it is on.
  The upgrade path that keeps them is Super Bot Fight Mode (Pro), not the free toggle.
- **The visitor count in web analytics is not the audience.** Count the Human signal
  action. The gap between the two lines is the bot volume, which is a useful metric of
  its own.
