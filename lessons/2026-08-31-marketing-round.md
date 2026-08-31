# A marketing round is mostly form plumbing

**Date:** 2026-08-31
**Area:** marketing — awesome-list PRs, Product Hunt, AlternativeTo

## What

Put Reely in front of people who are not already searching for it, without a
single line of product code:

- `docs/marketing/launch-kit.md` — the positioning constraint, the copy at every
  length a listing asks for (40/60/100/160/300 chars and long), the maker
  comment, a channel tier table and a dated submission status table. Everything
  else pastes from that file; nothing is written twice.
- Three awesome-list PRs, each following the target repo's own contributing
  rules rather than a generic template: awesome-shadcn-ui #606 (Platforms,
  alphabetical, three columns, no Date cell), awesome-nextjs #577 (Apps), and
  awesome-cloudflare #218 (Others / 其他, both READMEs, the Chinese row written
  by hand rather than left in English).
- Product Hunt: scheduled for Tue 8 Sep 2026, a week after the downloader's
  launch so the two do not compete.
- AlternativeTo: submitted, pending review, with thirteen alternatives attached.

The one constraint that governs all of the copy: **describe what Reely does —
discovery, tracking, playback through a source you configure — never what a
paywall loses.** No "free movies", no service named as something Reely replaces.
That is both the safe framing and the true one; no provider host is checked into
this repo.

## Mistakes

- **Wrote the PR numbers into the launch kit before opening the PRs.** The
  status table shipped with 1005 / 576 / 217 — invented placeholders, one of
  them off by one from the real number, which is the worst kind of wrong because
  it looks plausible. `gh pr list --author` is the only source for that column.
  Never write a table cell whose value a command can produce.
- **Anchored the awesome-cloudflare insertion on a generic table header.** The
  row landed in the Image Hosting table. `git checkout --` on both READMEs and
  re-anchored on `## Others` / `## 其他` plus the first `| ---` after it. A
  regex anchor in a document with fifty identical table headers matches the
  first one, not the intended one — anchor on the section heading, then scan
  forward.
- **Assumed a form input can be filled by typing into it.** Product Hunt's
  prefilled fields are React-controlled: `form_input` typed, the field showed
  the old value, and the submission would have carried it. Fixed by writing
  through the native `value` setter and dispatching `input` + `change`. Same
  class of bug swallowed a checkbox (the label ref did not toggle it; clicking
  the visible box did) and the tag combobox (it drops focus after each pick, so
  the field has to be re-clicked before every tag).
- **Read a "Something went wrong when trying to fetch the file" as the whole
  story on AlternativeTo.** Their server-side icon fetch of
  `https://www.reely.space/android-chrome-512x512.png` failed. Blamed our WAF on
  the strength of the IMDb shard self-fetch — wrong: `assetExpr()` in
  `scripts/cf-waf-setup.mjs` exempts `.png`/`.ico` from the UA challenge, and
  that URL answers 200 to an empty UA, to `python-requests` and to
  `Go-http-client` (measured 31 Aug). The failure was theirs. The local file
  upload had actually succeeded a moment earlier; the stale red error text hid a
  valid form. Check the resulting state, not the last error string.
- **Clicked a button at coordinates captured before `scrollIntoView` ran.** The
  page moved, the click hit empty footer, and the submit looked like it silently
  failed. Screenshot coordinates and JS `getBoundingClientRect` are in different
  spaces here (the screenshot is scaled) — click through JS, or re-screenshot
  after any scroll.

## What worked

- Reading each list's CONTRIBUTING before touching the README. awesome-shadcn-ui
  stamps the Date column from a workflow; a hand-filled date is a conflict.
- Declining the lists Reely does not belong in — awesome-selfhosted (needs a
  tagged release, disqualifies cloud-bound software), enaqx/awesome-react (its
  note asks people not to self-advertise), awesome-tailwindcss (no showcase
  section). A rejected PR costs more than the one that was never opened.
- Attaching alternatives on AlternativeTo. Their own banner says an app without
  them is nearly invisible in search; it is the cheapest visibility on that site.
- Preserving CRLF when scripting edits to other people's repos (`core.autocrlf`
  is on here): read the file, detect the EOL, split and rejoin on it. A
  whole-file line-ending flip is a diff no maintainer merges.

## Rules

- A status table's facts come from a command (`gh pr list --author`), never from
  memory or from what was about to happen.
- Insert into a foreign markdown file by anchoring on the section heading, then
  the first separator after it — never on a repeated table header.
- Any prefilled or controlled web form field: write via the native value setter
  plus `input`/`change`, then read the value back before submitting.
- When a directory says it could not fetch an asset from reely.space, measure
  before blaming the WAF: curl the URL with an empty user agent. Static
  extensions are exempt from the UA challenge (`assetExpr()` in
  `scripts/cf-waf-setup.mjs`); HTML paths are not.
- Marketing copy for this repo describes the catalog, the filters and the
  tracking. The player is "an external source you configure, behind a
  disclaimer — Reely hosts no video." Nothing in `docs/marketing/launch-kit.md`
  may drift from that.
