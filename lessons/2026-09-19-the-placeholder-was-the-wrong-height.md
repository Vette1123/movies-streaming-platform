# The placeholder was the wrong height

Date: 2026-09-19
Area: `styles/globals.css`, `hooks/use-carousel.ts`, `components/main-page/continue-watching.tsx`,
`components/media/details-poster.tsx`

## What

Two reports arrived together: a supporter band on the home page whose copy
"is cut, it has TON OF EMPTY SPACE", and "lag when scrolling down, specially on
mobile".

**The band.** `justify-between` across a band stretched to the page gutters,
with the paragraph holding a `max-w-[62ch]` reading measure. Those two
instructions fight: the copy stops at ~548px on the left, the button is pinned
to the right edge, and everything between them is nothing. Measured, the gap was
397px at 1280 and **1005px at 1920**. Capping the band at `max-w-5xl` and giving
the paragraph `flex-1 basis-80` instead of a fixed measure puts the CTA 24px
from the text at every width above 640px. It also turned three short lines into
two full ones from 1024 up (102px tall to 80px), and stopped the button wrapping
onto its own row at 768px.

**The lag.** `.cv-auto` — `content-visibility: auto` — reserved
`contain-intrinsic-size: auto 420px` for every poster rail. A rail is a heading
plus one poster row, and the poster row is sized by the card width, which steps
at sm/lg/2xl. So one number cannot be right, and 420 was wrong in *both*
directions:

| viewport | real rail | reserved | error |
|---|---|---|---|
| <640 | 336px | 420px | **over** by 84 |
| 640–1023 | 397px | 420px | over by 23 |
| 1024–1535 | 473px | 420px | under by 53 |
| ≥1536 | 503px | 420px | **under** by 83 |

Six rails on the home page. On a phone that is ~500px of page that does not
exist, collapsing upward as each rail realizes under a moving finger. The values
are now measured per tier: 336 / 397 / 473 / 503.

**The hero kept rotating after it left the screen.** Autoplay paused on
`document.hidden`, which only covers a backgrounded tab. Scrolled past, the hero
still advanced every 5s: a React re-render of the three mounted slides, a spring
over the track, and a backdrop decode — on a timer, landing on frames a finger
is already scrolling through. It now pauses on an IntersectionObserver too, with
a 200px margin so scrolling back up never reveals a frozen hero.

## Mistakes

**The homepage was fixed on a hunch and the production numbers said elsewhere.**
The intrinsic-size mismatch was found by measuring locally and it is real, but
`/`'s own CLS in PostHog is 0.0456 on mobile — fine. The bad numbers were
`/tv-shows/[id]` at **0.1303** on desktop and `/movies` at **0.1448** on mobile.
Detail pages carry two `List` rails, so the same fix does reach the worst
number — but that was luck, not aim. Querying first would have pointed at the
detail page, not the home page.

**`useNavbarScrollOverlay` was nearly deleted as dead code.** A grep for
`useScrollOverlay` — the wrong name — returned no callers, and the conclusion
"dead" was one keystroke from being written into a commit. It is imported by
`components/layouts/site-header.tsx`. Grep for the exported symbol, not for what
you remember it being called.

**Three attempts to prove a drag does not fire a click, none conclusive.** The
question was whether making the hero artwork a link would navigate on every
swipe. The harness throttles rendering to ~1Hz, so framer never sees enough
pointermove events: the synthetic drag changed neither the slide nor the URL,
which answers nothing. Two more variations would have answered nothing either.

**A stretched-bar fix was nearly shipped at `max-w-4xl` without measuring the
result.** It fixed the gap but left the copy at three lines. One measurement
across six widths showed `5xl` settles it to two, which is what "the text is
cut" was actually about.

## What worked

- **Same-origin iframes as a viewport rig.** `resize_window` does nothing when
  the window is maximized, but an iframe at `width:390px` evaluates media
  queries against its own box. That is what produced the 336/397/473/503 table
  and the 767→column / 768→row breakpoint check, neither of which could be
  measured any other way in this harness.
- **Injecting the real markup to measure a component that would not render.**
  The supporter band is gated on an account check that never resolves against
  the dev server. The band has no responsive classes, so the same markup inside
  a width-constrained wrapper is a faithful rig — before and after, side by side,
  at six widths, in one call.
- **`elementFromPoint` over a grid.** It confirmed the hero's whole artwork
  region hit-tests to one layout div, which is exactly the element PostHog
  named, without guessing from the class string.
- **Checking whether the reported class still exists.** The hero clicks named
  `h-full` where the code says `flex-1`; `git log -S` dated that rename to
  `b967947`, two days earlier. Same element, renamed — not a window measuring a
  fix, which is the trap the previous lesson recorded.

## Rules

- `contain-intrinsic-size` is a promise about height, and breaking it is felt as
  scroll jank whether or not it shows up as CLS. A shift below the fold does not
  count toward CLS and still yanks the page under a finger. Measure the real
  height at every breakpoint the content steps at, and write one value per step.
- Pausing on `document.hidden` is half a pause. Anything on a timer that
  re-renders or decodes should also stop when its own element is off screen.
- `justify-between` plus a max-width on one child is a contradiction at large
  widths. Cap the container, or let the child flex — never both instructions at
  once.
- Query the production numbers before choosing which page to fix. A local
  measurement tells you a thing is wrong, not that it is the worst thing.
- When the breakpoint at which a layout changes shape is written in more than
  one file, it is a constant. `DETAILS_ROW` exists because three class strings
  had to agree on `lg` and nothing made them.
- Stop after two failed attempts to prove something in the browser harness, and
  say the test was inconclusive rather than reasoning from it.
