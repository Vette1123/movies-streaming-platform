# The instruments that were always red

## What

Three measuring tools were lying, and one queue was never read:

- **The view-transition abort.** React 19.3 hangs `.finally()` off a view
  transition's `ready` and `finished` promises without catching them. A
  transition the browser SKIPS — a second navigation interrupting the first, or
  the tab going hidden mid-animation — rejects both with `AbortError:
Transition was skipped`, nothing catches it, and the browser reports an
  unhandled rejection. PostHog filed it, and it became issue #112. The guard
  in `lib/view-transition.ts` wraps the two promises so an abort RESOLVES:
  the transition is still skipped (the browser's decision), but nothing
  rejects that nobody catches.
- **The crawler check in `pnpm cf:health`.** It graded every 403 to a
  search-crawler User-Agent as a five-alarm fire. On 2026-10-20 that was
  fourteen requests a day, every one of them a scraper wearing Googlebot's
  name and asking for `/.env` — a refusal the operator chose. The script's own
  header says "a check that fails on a refusal the operator chose is a check
  that gets ignored, and an ignored check is worse than no check". It had
  been ignored for months.
- **The error-tracking queue.** 68 open issues, of which two were live. The
  other 66 were errors fixed months ago that nobody closed. `pnpm
errors:triage` now closes the dead ones (it asks PostHog what it has seen
  in the last N days and only closes an issue whose error has not been seen)
  and leaves the live ones open.
- **The pull-request queue.** PR #44 (+7,538/-2,243 across 96 files) was
  opened against a March 2026 snapshot of `main` and adds features that have
  all shipped since, in different shapes. Merging it would have reverted
  seven months of work. Eight renovate PRs from 2024 were closed as
  superseded by the 2026-10-17 dependency sweep.

## Mistakes

- **Wrote a broken file with PowerShell.** A `-replace` whose replacement
  contained `\n` wrote a literal backslash-n into `lib/ratings.ts` and the dev
  server served a build error for the next page load. The Edit tool does not
  have that failure mode. Use it for source edits and keep the shell for
  things that are not text.
- **Trusted a `@media (max-height:640px)`-style media query to be the reason
  a label was cramped.** It was not: the caption was a two-word phrase in a
  48px box, and the box was 48px because six actions share one 320px row.
  The fix was the label, not the layout.
- **Looked for the skipped transition in the app's own code first.** It is not
  in the app: it is in react-dom's RSC flush, which Next ships inside its
  app-page runtime. The fix had to go where the promise is created.
- **Almost widened the stale-deploy detector** to cover
  `(0 , r.buttonVariants) is not a function`. That phrase is too broad: it
  would have swallowed real TypeErrors to hide a five-event one-off. Closed
  the issue with the investigation written down instead.
- **The first health-check fix graded the PATH only.** A spoofed User-Agent
  asking for a real page is still a spoofed User-Agent. Both rules have to
  hold: the path is not one the WAF refuses on purpose, AND the User-Agent
  names no platform (a genuine Googlebot, bingbot, Applebot and DuckDuckBot
  all name no platform — a scraper wearing one does).

## What worked

- **Read the actual User-Agent strings.** Fourteen daily "Googlebot 403s"
  turned out to be `Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X …)
(compatible; Googlebot/2.1; …)` asking for `/.env`. Cloudflare's log was
  the evidence; the guess was not.
- **Made the probe fail on purpose.** With the guard removed, the view
  transition probe reports "1 unhandled rejection(s) from a skipped
  transition". A check that has never failed is not a check.
- **The triage script asks the source, not a human.** It closes an issue only
  when PostHog has not seen that error message inside the window, so the two
  live issues stayed open and the 66 dead ones went.

## Rules

- **A red instrument is worse than no instrument.** Before believing a check,
  make sure it can go green — and make sure it still goes red for the thing
  it exists to catch.
- **An unhandled rejection is a defect even when nothing is broken.** The
  page looked fine; the console was not; the tracker was full.
- **A queue nobody reads is a queue nobody works.** 68 open issues and 10 open
  PRs is the same failure as a permanently failing health check: the signal is
  there and it is ignored.
- **Write the triage down, then automate it.** The PostHog query, the `gh`
  call and the verdict are now one script that prints its plan before it
  closes anything.
