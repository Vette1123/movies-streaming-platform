# Sponsor card on every page

## What

- The owner could not find the sponsor card: it only mounted under the player
  after Watch Now, and never for supporters (the owner is one). It now shows to
  free users under the hero on the homepage and on every film and episode page
  (before play too), and above the footer on nearly every other page
  (`pagePlacement` in `lib/offers.ts` keeps it off legal, account, `/support`
  and `/advertise`).
- Placements are `home` / `details` / `page`; each is the affiliate `subid`, so a
  sponsor's dashboard shows which spot sold.
- "No sponsors, anywhere" moved from the small print to the second headline Pro
  benefit; the card carries "Remove with Pro" (`remove_clicked`) next to
  "Advertise here". /advertise, /support, the README and CLAUDE.md were rewritten
  to match.

## Mistakes

- The first version kept the old `!ready` gate, which renders nothing until
  hydration: a card above the homepage rails would have pushed them down on
  every visit. It is now in the static HTML, picked with `today: null` until
  hydration (build day and visit day differ, so a date-dependent pick would be a
  #418 mismatch), and supporters are hidden before paint by a `data-pro` flag the
  appearance boot script already had the data for.
- Counting "shown" on mount would have counted every page's footer card as an
  impression, mostly unseen. That is the number sold to sponsors; it now fires
  on 50% in view.
- Above the footer, the Masareef card sat directly over the footer's own app
  strip, which also leads with Masareef: the same pitch twice. Caught only in the
  browser. `promosBeside()` drops the app the card is already showing.
- The home card first used the detail pages' centred container, which did not
  line up with the edge-to-edge rails; capping it at `max-w-5xl` then left a
  half-empty row. The rails' own padding at full width was right.
- `tests/app-promo.test.ts` pinned "both apps on every page" by grepping for
  `PROMOS.map(`. A source grep pins the spelling, not the rule; replaced with a
  test of the pure helper.

## What worked

- Reading `use-location-pathname.ts` before trusting `usePathname()` in the
  layout: on a tail id it reports `/media-fallback` on server and client alike,
  so the layout slot can skip it without a mismatch.
- `127.0.0.1` when Chrome showed an error page for `localhost`.

## Rules

- Anything placed above existing content on a static route renders in the static
  HTML; hide it for the few with CSS before paint, never mount it for the many
  after hydration.
- An impression sold to a sponsor is counted in view, not on mount.
- A new site-wide surface is checked against what already sits next to it on the
  page, in a browser.
