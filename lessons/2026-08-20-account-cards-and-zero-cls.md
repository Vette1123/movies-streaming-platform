# Account tiles, and the layout shift behind them

**Date:** 2026-08-20

## What

The "Where to go next" grid on `/account` was flat: a default `border`, a 16px
muted icon floating next to the text, eleven tiles with a ragged last row. It is
now a tinted-icon tile with a hairline `border-white/10`, an inset top highlight,
a chevron affordance, a hover lift, and an odd last child that spans both
columns.

Chasing the same page's refresh behaviour turned up a real bug: `/account`
scored **CLS 0.4789** on every reload. That led to an app-wide sweep — spinners
replaced by skeletons that hold the settled shape, and a viewport of height
reserved on every page whose content is client-rendered.

Measured with a `PerformanceObserver({type:'layout-shift'})` driven from
browser-harness, 4x CPU throttle, desktop 1280x900 and mobile 390x844:

| Route | Before | After |
| --- | --- | --- |
| `/account` | 0.4789 | 0 |
| `/stats` | 0.0595 | 0 |
| `/movies` | 0.0416 | 0 |
| `/watch-history` | 0.0279 | 0 |
| `/tv-shows` | 0.0045 | 0 |
| `/` | 0.0025 | 0 |

The last ~0.008 on `/movies/<id>` at mobile width turned out to be **the Next.js
dev overlay**: probing the shifted rect at the moment of the entry named
`NEXTJS-PORTAL` (366x44, bottom-left, sliding into place). It does not exist in
the export, so every route is 0.

## Mistakes

- **Reached for the card grid first and treated the shift as a second task.**
  The same root cause (the page is a one-line spinner until the session answers)
  produced both the ugly loading state and the 0.48 CLS. Reading the state
  machine before styling the cards would have found both at once.
- **Assumed the sticky footer meant a short page could not shift.** The shell is
  `min-h-svh` with the footer as a sibling, so a short page pins the footer to
  the bottom of the viewport — which is exactly why it was *in* the viewport and
  the growth counted. A sticky footer makes CLS worse for a client-rendered
  page, not better.
- **Chased the `/movies` sidebar shift through three probes before checking who
  was signed in.** The shift only exists for a session: `SavedFilters` returns
  `null` until the account resolves, then appears above nine accordions. Two of
  those probes ran signed-out and measured nothing, which read as "intermittent"
  rather than "conditional".
- **Registered the CDP init script on the wrong target twice.**
  `Page.addScriptToEvaluateOnNewDocument` binds to the target it is called on,
  and `new_tab()` creates a new one — so the stub never ran and the page kept
  rendering signed-out. The working order is `new_tab("about:blank")` →
  register → `goto_url(...)`, which also hydrates properly.
- **First draft of the placeholder guessed a height.** A guessed reserve is a
  smaller shift, not zero. The exact one needed `presets` in the profile cache,
  which was three lines.

## What worked

- One skeleton vocabulary in `components/ui/skeleton.tsx` (`Skeleton` now
  carries the sheen, plus `SkeletonRows` / `SkeletonMediaRows`), so a panel that
  loads looks like every other panel that loads and nothing is hand-rolled.
- The hint cookie + profile cache as a *layout* input, not just an avatar input:
  `hasAccountHint()` says whether to reserve at all, `cachedProfile()` says how
  much. A visitor with no session reserves nothing and still shifts nothing.
- Measuring every route at 4x CPU throttle on two viewports. The desktop-only
  pass would have missed nothing here, but it is what proved the fixes rather
  than assuming them.

## Rules

- **A page whose content is client-rendered reserves a viewport.** `min-h-svh`
  on the section keeps the footer below the fold while the real content lands;
  growth nobody can see is not a layout shift.
- **A loading state holds the settled shape.** One line of "Checking…" where a
  full console is about to appear is a layout shift with a label on it.
- **Before reserving space for something conditional, find the synchronous
  source that predicts it** (hint cookie, profile cache, localStorage). Reserve
  exactly, or reserve nothing.
- **Animating anything but `transform`/`opacity` shows up as CLS.** If a
  measured shift has a `GONE` node and a moving `top`, look for an animation
  before looking for a data load.
- **Identify the shifted node inside the observer callback, not after.** By the
  time the run is read back, `entry.sources[].node` is often detached and prints
  as null. `document.elementsFromPoint()` on the entry rect, called synchronously
  in the callback, is what named the dev overlay — and a dev-only shift is worth
  ruling out before writing any code.

## Follow-up, same day

Three things came out of using the result.

**The mobile section rail was unusable.** Twelve sections in a horizontal
scroller showed three of them, and the scrollbar drew a grey bar across the page
that read as a broken progress indicator. Replaced below `lg` with one control:
a button that says which section you are in, opening a bottom sheet listing all
twelve. Same `items` array, same `onSelect` — the rail is still one definition,
it just has two shapes.

**"Where to watch" is gone.** It shipped the day before as an SEO surface: the
crawlable list of services a title streams on. On a site that streams the title
itself, it is a signpost to a competitor under our own player. Removed the
section, the component, `lib/watch-availability.ts`, the `availability` field on
both detail payloads, its tests, and the `watch/providers` append that fed it —
which also takes 10-20KB of country-list JSON back off every build-time detail
fetch. The browse filter's provider picker stays: that one narrows what you are
shown here, it does not send anybody away.

**The app reloaded itself while you were away.** `ServiceWorkerRegister` watched
for `controllerchange` and called `window.location.reload()` — deferred to the
next foregrounding if the tab was visible, immediately if hidden. It was written
to solve a real problem (a standalone PWA can sit on a retired build until it
asks for a deleted chunk) but the cost is the thing a user actually feels:
leaving the app and coming back to a document that threw your place away. The
update check on foreground stays; the reload is gone entirely. A page that does
hit the stale-deploy boundary is still recovered by `lib/client-errors.ts`,
which is error recovery rather than a background refresh.

### Rules

- **Nothing reloads the page on its own.** Not for a deploy, not for a service
  worker, not while the tab is hidden. Recovery from an actual error is the only
  exception.
- **A horizontal scroller is not navigation when the list is long.** Three
  visible labels out of twelve is a menu the user cannot see; give it one control
  and a sheet.
- **Do not build a feature that points at a competitor for the thing this site
  already does.** SEO value does not outrank that.
