# The tip jar could not be closed, and the fix came from the other repo

**Date:** 2026-08-20
**Area:** `styles/globals.css`, `lib/bmc-widget.ts` — Buy Me a Coffee floating widget

## What

Ported, in one sitting, the four fixes the downloader project worked out on a
real phone over four rounds:

- the z-index band split — backdrop and iframe to 60, `#bmc-wbtn` alone to 39
- the bundle's mobile close button moved out of the status bar to bottom left
- lifted 64px so it clears the provider's own footer pill
- `message: ''`

Nothing here was diagnosed on this repo's own screen. It is the same vendor
bundle, byte for byte, and the same band mistake in our CSS, written in two
different selector styles.

## Mistakes

**One band for a widget that is two different things.** The rule said 40 keeps
the tip jar "above the page and under everything of ours" — true of a 64px
button in a corner, false of the same widget open on a phone, where it is a
full-screen overlay and has to outrank our dialogs and toasts instead.

Worse, flattening the button and the backdrop onto one layer breaks closing
outright. The vendor's button handler only ever _opens_: it swaps the cup for a
chevron and keeps the same onclick. Closing is the backdrop's job, and it works
only because the backdrop sits above the button at 9999999 vs 9999 and swallows
the click. Equal z-index hands it back to DOM order, the button is appended
last, and the chevron starts re-opening what it appears to close.

**Two repos, one bug, and the shared file is the loader — not the CSS.**
`lib/bmc-widget.ts` names its twin in the downloader and is kept in step by
hand, which worked. The CSS band exists in both too, and nobody wrote that down,
so it drifted into two selector styles — `body > div[style*='z-index: 9999']`
here, `body > div:not([class])` there — expressing the same intent with the same
flaw. The comment that would have caught it was in the other repo.

**Ported without a device.** `tsc` is clean, the selectors are checked against
the bundle's actual inline styles, and no phone has touched this. The downloader
took four rounds precisely because each round was checked on a screen; this one
has had none. Position differs too — this widget is bottom-LEFT to stay off the
hero's trailer toggle — so the close button moved to the matching corner, and
that is the one line here that is not a straight copy.

## What worked

Reading the minified bundle, once, in the other repo. `curl` it, break on `;{}`,
and 8KB becomes eight readable handlers — button-never-toggles, the backdrop is
the close handler, `#bmc-close-btn` exists but only below 480px, and it is
hard-coded to `top: 16px; right: 16px` regardless of `data-position`. Every fix
in both repos follows from those four facts.

## Rules

- A widget that is a corner button in one state and a full-screen sheet in
  another needs two z-index answers. One band for both is a bug waiting for
  whichever state was not being looked at.
- When a `!important` band flattens several nodes to one layer, DOM order
  decides — and appending order inside a vendor bundle is neither ours nor
  visible from our files.
- `top: 16px` is inside the status bar once the app is installed. Anything a
  third-party widget fixes to a screen edge needs re-placing with `env()` in a
  `viewport-fit: cover` app.
- The hand-kept twin is `lib/bmc-widget.ts` ↔ the downloader's inline loader in
  `src/app/layout.tsx`. The CSS band is a third copy that nothing pointed at —
  when one moves, grep the other repo for `bmc` before assuming the loader was
  the whole surface.

---

Related: [2026-08-19](2026-08-19-bmc-floating-widget.md) and
[2026-08-19](2026-08-19-bmc-widget-off-critical-path.md) — the same widget,
placed and then taken off the critical path.

Downloader-side lesson, where this was actually diagnosed:
`social-media-downloader/lessons/2026-08-20-bmc-widget-close-zindex.md`.
