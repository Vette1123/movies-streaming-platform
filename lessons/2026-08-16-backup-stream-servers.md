# Backup streaming servers, and a WAF posture that stops flipping itself

**Date:** 2026-08-16

## What

Reely had exactly one embed provider. When it was down, or simply never carried
a title, the visitor got a black rectangle that never resolved and no way to
tell that the fault was upstream.

Now:

- `config/sources.ts` — an ordered list of servers, **entirely from the
  environment** (`NEXT_PUBLIC_STREAMING_MOVIES_API_URL`, `NEXT_PUBLIC_STREAM_SOURCE_2/3`).
  No provider host appears in this repository, and the UI names them
  "Server 1/2/3" rather than by host.
- `hooks/use-stream-source.ts` — resolves per title → account preference →
  device preference → default, and writes the choice to all three on a switch.
  The account half rides in `prefs`, which already syncs, so a server chosen on
  the laptop is the one the phone starts on.
- `components/player/source-switcher.tsx` — always-visible chips while a stream
  is playing, plus **one** automatic hop when a frame has not painted after 9s.
- A supporter feature (`canSwitch`). Somebody who is not supporting gets exactly
  the single server the site has always used, and sees the offer only at the
  moment a stream stalls.
- `WAF_PERMISSIVE` is read from a repository variable in the deploy workflow.

## Mistakes

- **The switcher was placed at `bottom-6` and was unclickable.** The PWA install
  prompt sits at the bottom of the viewport and `document.elementFromPoint` on
  the chip's own centre returned the install button. Two lessons: anything
  overlaid on a player has to be hit-tested rather than eyeballed, and the
  bottom edge of a video is the most contested space on the page — the embed's
  own scrubber is already there.
- **Then it was moved to `top-4` and was still unclickable**, this time under the
  sticky site header. Fixed at `top-20`. Both rounds were caught in about a
  minute by `elementFromPoint`, and neither would have been caught by a
  screenshot: the button was fully visible in both.
- **Faking a supporter locally does not work by writing the profile cache.**
  `refreshAccount` fires on any page with the hint cookie, the dev server has no
  Worker to answer `/api/account`, and the failure path overwrites the cache with
  `pro: false`. Removing the cookie does not help either — `markSignedOut()`
  clears the cache outright. What worked was a one-line local override of
  `canSwitch`, run, then reverted. Write down which account a UI check ran as.
- **`pro` came from `useAccount()` at first**, which is the raw store and is
  `false` until the account refresh settles. A supporter opening a cold detail
  page would have been pinned to the default server for that title. Changed to
  `useAccountIdentity()`, which is cache-backed — the same reason the header
  paints from it.
- **A side effect went inside a `setState` updater** (`writeJson` inside
  `setByTitle`), and `advance()` inside another. Updaters must be pure; React may
  run them twice. Both moved out.
- **The support page's unlock grid went ragged twice.** Its layout rule is "the
  first two take half a row, the rest sit in thirds", which only looks right at
  2 + a multiple of 3. Seven entries left a hole; eight is correct. Noted in the
  code so the next entry does not have to rediscover it.

## What worked

- **`elementFromPoint` on the element's own centre** as the standard check for
  anything overlaid. Cheap, and it catches the class of bug a screenshot cannot.
- **Deriving the embed URL from state rather than storing it.** Both heroes now
  hold _what_ is playing (a boolean, or an episode target) and compute the URL
  from the chosen server, so switching cannot leave the two disagreeing.
- **The headless verification loop.** `--headless=new --remote-debugging-port=9333`
  against a scratchpad profile: real clicks, real hit-testing, no windows.

## Rules

- **Hit-test every overlay** with `elementFromPoint` before believing it works.
  Visible ≠ clickable, and the bottom of a video is already crowded.
- **Deployment configuration that names a third party belongs in the
  environment, not in a public repository** — and the UI should not print it
  either. This buys discretion, never secrecy: an iframe `src` is readable by
  anyone who opens devtools, and pretending otherwise would be the real mistake.
- **State updaters are pure.** Storage writes, navigation and callbacks go
  outside them.
- **Anything gating on `pro` in a render path reads `useAccountIdentity()`**, not
  `useAccount()` — the raw store says `false` for the first few hundred ms of
  every cold page.
- **A CI step that mutates infrastructure must read its posture from a variable,
  not a constant.** `waf:apply` hard-coded the hardened path, so a deliberate
  permissive window set from a laptop was silently reverted by the next push.
- Say which account a browser check was run as, in the report as well as the
  notes.
