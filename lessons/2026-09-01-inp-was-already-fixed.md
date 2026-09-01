# The failing metric had already been fixed, and the browser could not have told me

**Date:** 2026-09-01
**Scope:** closing the last open item from the end-to-end sweep — "mobile INP
246ms, the only failing Core Web Vital" — plus the landmark and heading gaps
found on the way.

## What

Went after mobile INP with the browser first and the field data second. That
order was backwards, and it cost most of the session.

The answer, from PostHog's own `$web_vitals`:

| Week (mobile, p75) | INP       |
| ------------------ | --------- |
| 2026-07-12         | 436ms     |
| 2026-07-26         | 330ms     |
| **2026-08-02**     | **168ms** |
| 2026-08-16         | 168ms     |
| 2026-08-30         | 204ms     |

Sitewide mobile p75 over the last 30 days is **176ms** across 2,641 samples —
inside Google's 200ms bar. The step change lands exactly on the static-export
migration of 2026-08-03. The 246ms figure came from CrUX, whose window is 28
days of trailing data, so it was still averaging in the OpenNext era. Nothing
to fix; the fix shipped a month ago.

Shipped alongside, from the same sweep:

- The TV episode panel had no name and no heading — a page outline that ran
  `h1` → "Cast" with the most important content on the page absent from it.
- `/mood` rendered a wall of posters under no heading at all once a mood was
  picked.
- `/match-night` lost its `h1` the moment a room opened: the lobby has one, the
  in-room view replaced it with nothing.
- Two more `<aside>` complementary landmarks with no accessible name.

## Mistakes

**Spent the first half of the session measuring INP in a tab that cannot
measure INP.** The automated tab is `visibilityState: hidden`, which throttles
rendering to roughly 1Hz. Every LoAF entry it produces is quantised to that:
the "3,904ms click, 2,393ms of style and layout" that framed the whole
investigation was four throttled frames, and the giveaway was sitting in the
data the whole time — four separate long-animation-frame entries of 1002, 1003,
1003 and 1003ms on a page doing nothing. I built an attribution story on top of
that number, went looking for the 2.4s of style and layout in the codebase, and
found candidates (a 40-image blur-up, `will-change` on every card) that were
plausible precisely because I had a number to explain. **A harness that throttles
rendering can produce any INP you like.**

**Asked the browser a question the field data already answered.** Two PostHog
queries — one breakdown, one weekly trend — settled it in under a minute. They
should have been the first thing, not the recovery.

**Nearly shipped two speculative performance changes.** Swapping the poster
blur-up for an opacity fade, and moving `router.prefetch` out of the touchstart
handler. Both were measured before writing: the touchstart handler costs
**0.1ms** after the first call (1.8ms cold), and the reveal is a compositable
`filter` transition. Neither was ever the problem. Measuring first is the only
reason they are not in the diff.

**Read a transparent header as a bug.** `/mood` screenshotted with the nav
labels showing through the page content at `scrollY: 394`. The class was
applied and correct; CSS transitions are frozen in a hidden tab, so the
200ms fade to `bg-background/80` was stuck at 0.3% opacity. Fourth distinct
variant of the same harness blind spot this week.

**One audit false positive worth naming.** The match-night search input
reported "no accessible name". The audit checks `aria-label`, `aria-labelledby`
and text content, and does not check `<label for>` — which is exactly how that
input is named. An audit that does not know how a name can be built will invent
findings.

## What worked

**Per-route field data pointed at real structure, not noise.** Detail pages,
2,311 samples, p75 176ms. Home 184 samples at 256, browse 115 at 268 — and the
per-week splits behind those are 2 to 65 samples, which is how a single slow
tap becomes a 738ms "p75". Knowing the sample count is what stopped a refactor.

**The heading and landmark gaps were all found the same way.** Not by looking:
by listing every `h1`–`h6` and every `<aside>` on each route and reading the
outline. "The episode list is missing from the page structure" is invisible in
a screenshot and obvious in a five-element array.

**Every fix went where the pattern was, not where the symptom was.** Three
unnamed `<aside>`s got named in one pass; the episodes panel got the sr-only
heading its outline needed rather than a label alone.

## Rules

- **Field data before browser instrumentation, always, for anything about
  speed.** Percentiles come from real devices. A local browser tells you about
  a local browser — and this one is throttled.
- **Never measure INP, LoAF or any frame timing in the automated tab.** It
  renders at ~1Hz. Frame durations clustering near 1000ms are the tell.
- **Check the sample count before believing a percentile.** A p75 over 2
  samples is not a p75.
- **A CrUX or PageSpeed number is up to 28 days stale.** Before optimising for
  it, ask what the last month's own telemetry says — a metric can already be
  green while the public one is still red.
- **Measure the thing you are about to change before you change it.** Both
  candidate optimisations here died on a one-line measurement.
- **A page that swaps its whole view on state (lobby → room, picker → results)
  has two outlines, and only one of them is usually checked.** Audit the second
  state too.
- **An `<aside>` is a complementary landmark and needs a name.** Prefer
  `aria-label` over `aria-labelledby` when the subtree it would point at is
  rendered more than once per page — a mobile sheet and a desktop sidebar
  sharing one component is a duplicate id waiting to happen.

## Related

- [`2026-09-01-h-6-is-not-24px.md`](2026-09-01-h-6-is-not-24px.md) — the sweep
  this closes out, and the first three variants of the hidden-tab blind spot.
