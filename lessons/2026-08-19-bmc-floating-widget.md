# Buy Me a Coffee's floating widget

**Date:** 2026-08-19
**Files:** `app/layout.tsx`

## What

Added the Buy Me a Coffee floating widget — the `<script>` their dashboard's
widget generator hands you — to every page, in the root layout's `<head>`.

It is a tip jar and nothing more. It sells coffees, not the membership levels
in `config/support.ts`, so nothing paid through it grants supporter status:
`lib/billing/bmc.ts` matches on the offer name and its `fallback` is `null`.
That includes the panel's "make this monthly" checkbox, which does fire a
recurring event but carries a level name no project configured. The path that
actually switches somebody on is still `/support`. That is written into the
comment above the tag, because the person who finds it will be reading it after
a supporter emails to ask where their server switching went.

## Mistakes

**Reached for `next/script` first, and it silently did nothing three times.**
`lazyOnload`, then `afterInteractive`, then `beforeInteractive` — every one of
them downloaded the bundle (confirmed in `performance.getEntriesByType`) and
rendered no button. The vendor builds its widget inside a `DOMContentLoaded`
listener, and every `next/script` strategy injects the tag _after_ that event
has already fired, so the listener is registered for something that will never
happen again. The tell was there in the first check and I read past it:
`scriptInDom: true` with zero `bmc*` DOM nodes and zero globals is not a
loading problem, it is a script that ran and did nothing.

Three strategy swaps cost more than reading 8KB of minified vendor code would
have. `curl`-ing the bundle and grepping it for `DOMContentLoaded` answered the
question in one command, and should have been the _first_ command, not the
fourth. A third-party bundle you are about to wire into every page is small
enough to interrogate.

The fix is the platform, not the framework: a plain `<script defer src=…>` in
the layout's `<head>`. Deferred scripts run in order immediately _before_
`DOMContentLoaded`, so the listener always lands in time, and the parser is
never blocked. `next/script` had nothing to add here.

**Shipped it to the corner the generator picked, over a control that was
already there.** The default `data-position="Right"` put a 64px button at
z-index 9999 across 42% of the hero's trailer-autoplay toggle — a permanent
control, not a transient one. Nothing in the app goes above z-100, so a vendor
widget wins every stacking contest by three orders of magnitude and you only
find out by measuring. The rectangle-intersection sweep over every
`button, a, [role="button"]` is four lines and named it immediately.

**Then set `data-position="Left"` and it stayed on the right.** The vendor
compares `"left" == dataset.position` — lower-case, strict. Their own generator
writes `"Right"`, so _both_ capitalised values fall through to the same `else`,
and a capitalised `"Left"` looks applied while doing nothing. Confirmed by
reading `getComputedStyle`: `left: 2470px, right: 18px`. Reading back the
computed style, not the attribute, is what caught it.

**Local verification tripped over Next's own dev overlay.** The dev indicator
lives in the bottom-left too, and the first click at the widget's centre opened
the Route/Bundler panel instead. `document.querySelectorAll('nextjs-portal')
.forEach(e => e.remove())` before clicking. It is dev-only, so it says nothing
about production, but it will eat every bottom-left click until it is gone.

## What worked

- Reading the vendor bundle. `curl … | grep -o 'DOMContentLoaded\|bmc-wbtn'`
  and a `grep -o '.\{80\}position.\{160\}'` window around the position handling
  explained both failures outright. Minified is not unreadable.
- Measuring overlap instead of eyeballing a screenshot. The screenshot showed
  the two controls near each other; the intersection sweep gave 666px² and
  turned "looks a bit close" into a fact.
- Checking `getComputedStyle` rather than trusting the attribute round-trip.

## Rules

- A third-party widget that bootstraps on `DOMContentLoaded` cannot be injected
  by `next/script` at any strategy. Put it in the HTML with `defer`.
- Before adding a vendor `<script>`, `curl` it and grep for how it boots and
  which attribute values it actually compares. It is cheaper than one retry.
- A downloaded script that produced no DOM is not slow — it is finished. Stop
  swapping loading strategies and read it.
- Any fixed-position vendor widget gets a rectangle sweep against every
  interactive element before it ships. Nothing here goes above `z-100`, so the
  widget always wins the click.
- Verify vendor attributes through `getComputedStyle`, not by reading back the
  attribute you just set.
- Remove `nextjs-portal` before clicking anything in the bottom-left in dev.
