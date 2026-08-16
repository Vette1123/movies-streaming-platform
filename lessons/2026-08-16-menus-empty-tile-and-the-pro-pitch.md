# Menus that close, an empty tile, and asking a supporter for money

## What

Four fixes reported together off a real phone:

1. **Header popovers stayed open after picking a row.** Radix `Popover` keeps its
   content open when something inside it is clicked — correct for a form, wrong
   for a menu. The account menu, the apps list and the links list all left a
   panel hanging over the page they had just navigated to; on a phone that panel
   covers most of the screen.
2. **An empty card in the account library.** `SYNCED_STORES` gained a fourth
   store (`reviews`, shipped with ratings) but `LibraryPanel`'s hand-written
   `STORE_LABELS` and `counts` maps did not, so the fourth tile rendered
   `undefined` over `undefined` — a bordered box with nothing in it.
3. **No route to the plans on a phone header.** The support heart was inside the
   header's `hidden md:flex` nav. On mobile the only ways to `/support` were the
   drawer (a hamburger plus a scroll) and the footer (the bottom of every page).
4. **Supporters were still being sold to.** The footer card, the drawer row and
   the command palette all pitched the plans to people who had already bought
   them — against the support page's own promise that "the moment support
   lands, Reely stops asking".

Fixes: one shared `PopoverRow` in `components/ui/popover.tsx` wrapped in
`PopoverPrimitive.Close`; `label` moved onto `SYNCED_STORES` so the panel can
only render stores that have one; the heart moved out of the desktop-only nav
into the always-visible cluster (header gap tightened to `gap-2` under `sm` to
pay for it); and `FooterSupportCard` / `SupportDrawerSection` / the palette row
swap to a management wording once `useAccountIdentity` reports `pro`.

## Mistakes

- **Nearly "fixed" the popovers by adding an `onClick` to each row.** Three
  surfaces, three copies, and the next row anyone adds is open again. Radix
  already ships `Popover.Close`; wrapping the one shared row component means no
  row on any surface can exist without the behaviour. The ladder's "native
  platform feature covers it" rung, one level up from the obvious fix.
- **Tested the auto-close with a capture-phase `preventDefault` and read the
  result as a failure.** Radix composes handlers with
  `composeEventHandlers(..., { checkForDefaultPrevented: true })`, so cancelling
  the event in the harness is exactly the thing that stops it closing. The test
  harness broke the feature it was measuring.
- **Then read `!!document.querySelector('[data-radix-popper-content-wrapper]')`
  as "still open".** The wrapper survives the exit animation. `data-state` on
  the content is the real answer; the wrapper is not.
- **`pnpm dev` cannot render any of this.** `/api/*` lives in the Worker, so the
  account page sits on "Checking your account" forever — the same trap as
  2026-08-16-ratings-recs-import.md. Rather than boot `pnpm preview`, stubbed
  `/api/auth/refresh` and friends with
  `Page.addScriptToEvaluateOnNewDocument` and drove every section as a
  supporter. Note the ordering: the script has to be registered on the target
  **before** `goto_url`; registering it and then calling `new_tab` puts it on
  the wrong target and silently does nothing.
- **Hunted the "empty card" by reading files first.** Ten panels read before
  finding it; the DOM sweep that actually found it — every element with a
  `border`/`rounded`/`bg-card` class whose `innerText` is empty and that has no
  `img`/`svg`/`input` inside — took one pass over all eleven sections and is
  reusable.

## What worked

- The empty-box sweep, run per section, before and after. It found the tile and
  then proved nothing else on `/account`, `/stats` or `/support` was in the same
  state.
- Putting `label` next to `key` and `store` in `SYNCED_STORES`. The bug was a
  second table that had to be edited in step with the first; there is now one.
- Checking `document.documentElement.scrollWidth` at 360px and 390px after
  adding a control to the header — the heart cost the search box its label until
  the gap came down, and neither is visible in a passing typecheck.

## Rules

- A menu inside a Radix `Popover` closes with `Popover.Close`, wrapped once
  around the shared row — never with an `onClick` per caller.
- A list rendered from a shared table carries everything it needs to render in
  that table. A second map keyed by the same ids is a bug with a delay on it.
- Verifying a click handler in the harness: never `preventDefault` the event
  first, and read `data-state`, not the presence of the portal wrapper.
- Account UI is verified signed-in — under `pnpm preview`, or with the API
  stubbed via `Page.addScriptToEvaluateOnNewDocument` registered on the target
  before navigating.
- Anything that asks for money checks `useAccountIdentity().pro` first. A
  supporter sees the same control pointing at the same page, worded as
  management.
