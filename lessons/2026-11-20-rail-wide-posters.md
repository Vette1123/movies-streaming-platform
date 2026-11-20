# Wide screens showed dark poster boxes on reload

## What

The static homepage rails put an `<img>` in the HTML for the first 6 cards only
(`RAIL_ENTRANCE_COUNT`). Six covers screens up to ~1700px. On a 2560px monitor, cards
7-9 stayed as empty `bg-slate-900` boxes until `LazyRail` swapped in the interactive
List, which waits for window load + idle (up to 4s). Now cards 7-14 also ship a
`loading="lazy"` poster inside `hidden 2xl:block` (`RAIL_WIDE_POSTER_COUNT`), with the
empty box `2xl:hidden`.

## Mistakes

- The comment on `RAIL_ENTRANCE_COUNT` said it was "about what the widest screen shows".
  It was what a ~1700px screen shows, and nobody measured it on a 2560px screen.
- The first iframe probe of the script-free HTML read every card as an empty box, the
  first six included. The tab is hidden, so `content-visibility: auto` skipped layout and
  every rect was 0. Read `img.complete` / `naturalWidth`, not rects, in this tab.

## What worked

- Rendering the server HTML with its scripts stripped, in a same-origin iframe, freezes
  the pre-swap state that a reload shows. At 2560px the wide posters loaded. At 1400px,
  with cache-busted URLs, 0 of 36 were displayed or fetched.

## Rules

- A count of "what fits on screen" is checked at the widest real monitor (2560-3840px),
  not the dev laptop.
- Breakpoint-only images: `display:none` + `loading="lazy"` is never fetched, so a phone
  pays nothing for them.
