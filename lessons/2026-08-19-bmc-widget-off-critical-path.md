# The tag was correct and I stopped there

**Date:** 2026-08-19
**Files:** `app/layout.tsx`, `lib/bmc-widget.ts`, `styles/globals.css`

## What

The tip jar added earlier today (see
[BMC floating widget](2026-08-19-bmc-floating-widget.md)) now builds itself
after `load`, in idle time, instead of shipping as a deferred tag in `<head>`.
The loader moved to `lib/bmc-widget.ts`; one rule in `styles/globals.css` takes
the widget's stacking away from it.

## Mistakes

**Stopped at "it renders".** The previous lesson ends on the plain
`<script defer src>` as the answer, and it is the right tag — but `defer` only
means "not parser-blocking". The bundle, its webfont and its iframe still
download as part of the page load, and a deferred script still delays
`DOMContentLoaded`. For a donation button most readers never touch, that is the
first paint paying for something nobody asked for. Nothing in the first pass
asked what the working tag cost, because the whole session had been spent
getting anything to appear at all — three `next/script` strategies deep, "it
finally works" felt like the finish line.

**Swept for click overlap and called the stacking checked.** The rectangle sweep
that caught the hero's trailer toggle only compares against elements that exist
when the page loads. Dialogs, sheets and toasts do not — they mount later, at
`z-50`, under a widget sitting at `9999`, and the sweep can never see them. The
widget has been floating over every modal in the app since it shipped this
morning. The corner was measured; the third dimension was not.

**Left the two projects' copies to drift.** The downloader shipped the idle
loader first, and this repo kept the deferred tag — two versions of the same
widget with different behaviour and no note in either pointing at the other.
Now both files say so out loud.

## What worked

Porting the loader instead of rewriting it: the two differ only in the settings
object, so the reasoning that justified it — why `async` is not an option, why
faking `DOMContentLoaded` after `load` is safe, why the corner is lower-case —
was already written and only had to be checked against this app.

Measured on the production build, not `dev`: `domContentLoadedEventEnd` 228ms,
`loadEventEnd` 470ms, widget's first request 1200ms. Before, that request was
inside the page load.

The stacking rule had to hold onto the widget by shape — two of its nodes carry
no id and no class — so it keys on the inline `z-index: 9999` the bundle writes
on them. Verified by listing everything the selector matches: three nodes, all
the vendor's. `sonner` and the Radix portals set their stacking from classes and
are untouched.

## Rules

- "It renders" is not the end of a third-party integration. Ask what it costs at
  the moment it renders, and whether that moment can be later.
- `defer` keeps a script out of the parser, not out of the page load. If a
  vendor's work can happen after `load`, make it happen after `load`.
- An overlap sweep at page load cannot see the overlays that mount later.
  Compare a vendor's z-index against the app's ceiling as well as its rectangle
  against the app's controls.
- The same widget in two repos needs a line in each naming the other, or they
  drift the moment one is improved.
