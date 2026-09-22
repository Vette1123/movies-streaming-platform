# The five features had never shipped

## What

End-to-end pass over the 2026-09-22 "five killer features" (share card, phone
remote, taste compare, tonight's triple, airing chip). None of them had reached
production: `qrcode.react` went into `package.json` without the lockfile, so
every deploy since `7823ef6` (three runs, two of them the 6-hourly refresh) died
at `pnpm install --frozen-lockfile` in 23 seconds. Fixed first and pushed alone
(`f5042f1`); CI now also runs `pnpm test` before it deploys.

Then the review findings, each verified before fixing:

- **Invites made hosts.** `inviteHref` did `url.host = ''` — the hostname, a
  silent no-op on https — so `host=1` survived into every invite and QR. The
  suite had two red tests for exactly this; nothing ran the suite.
- **Remote:** a command was consumed even when no house player could take it
  (before play, or on an embed) — now drained only while the house player is
  the one reporting. The pad snapped back to the stale beat between the press
  and the drain — `remoteView` shows a pending command. A reloaded host
  replayed the last press — the first read seeds `appliedCmd`. Ages are
  measured on the Worker's clock (`now` on the state read), not the device's.
  The phone kept polling a swept room. The remote endpoint is one `UPDATE`
  checking `meta.changes` instead of SELECT-then-UPDATE.
- **Hydration:** the hero read `window` during render to mount the together
  bar — a `?watch=` link hydrated a bar the server HTML never had. Now
  `useMounted`-gated.
- **Triple:** "Spin again" returned the same three titles for any list with a
  film in it. **Compare:** every failure (429, 5xx, offline) was reported as
  "no public profile"; `@handle`, a pasted profile URL, and `?a=x&b=X`
  (self-compare at 100%) all slipped past validation; the page had no
  OpenGraph, so a sent link unfurled as the homepage.
- **Dates:** the airing chip and the triple's day both rolled over at UTC
  midnight — 8pm in New York, 3am in Cairo. Both now use the visitor's local
  day (`lib/local-day.ts`, one helper for both).
- **Share:** a card that took longer to draw than the user-activation window
  got `NotAllowedError` from `share()` and ended in an error toast with no
  picture. `shareOrDownloadFile` (hooks/use-share.ts) falls through to the
  download on anything but a dismissal; the stats card, which had a silent
  copy of the same block, uses it too.
- Six hero actions wrapped "Card" onto its own row on every phone — measured
  at 360/375/393px in a width-pinned iframe: one row, 308px, after `gap-1` +
  `w-12` captions below `sm`.

## Mistakes

- **My first fix for the spin bug did not fix it.** I replaced "fall back to
  the three shortest" with a greedy walk in seed order and wrote a test that
  passed. The browser showed the same triple on four of five spins: greedy
  takes a film first (115 fits alone), strands itself at two, and falls back
  to shortest-three anyway. The test had used 30-minute series, short enough
  for a film to fit beside two of them — the one shape where greedy works.
  The real rule is "take an item only if a fitting completion still exists",
  which one pass satisfies because room only shrinks. The test now uses the
  runtimes the browser caught it with, and was measured against the old code
  (1 distinct triple in 12 spins) and the new (6).
- Even the second test version passed on the old picker at first: equal
  runtimes let the stable sort keep seed order among ties, so "three shortest"
  still varied. Every regression test here was run against the pre-fix code
  before it was trusted.
- Added a smoke-test path for `/api/together/state` to catch a missing D1
  migration, then found the WAF answers curl with 403 — which the smoke loop
  counts as healthy. A check that cannot fail is worse than none; removed.
  Migrations are still manual (`pnpm d1:migrate:remote`); 0009 was verified
  applied.
- The review agents were right about the lockfile before I read their
  reports — I had found it from `gh run list` independently. Checking CI
  status is step one of "check the latest commits", not something to reach
  after reading diffs.

## What worked

- `gh run list` first: three red deploys was the single most important fact
  about those commits, and it was one command away.
- Three parallel review agents, one per feature pair, each told to mark
  findings CONFIRMED or PLAUSIBLE — then every finding re-verified in code
  before fixing, and one (a remote-key "security" fix) consciously declined:
  the room code is already the capability, `/api/together/beat` has never been
  authenticated, and everyone in a party pressing pause is the party.
- Hidden-tab browser work: screenshot first, then query; a same-origin iframe
  at a fixed width is a phone viewport when `resize_window` does nothing; a
  Suspense wrapper stuck at `display:none` in a background frame can be forced
  visible to measure real layout.

## Rules

- A dependency change ships with its lockfile, and CI runs the tests before it
  deploys — a red suite on main is a bug report nobody is reading.
- A regression test is not trusted until it has failed on the pre-fix code.
  Seed it with the data that exposed the bug, not data you invented.
- "Pick in seed order under a budget" means "take it if a completion still
  fits", never plain greedy.
- A day boundary a person reads ("tonight", "airs today") is their local day —
  `lib/local-day.ts`, only after mount.
- A health check that treats the WAF's 403 as success is not a health check.
