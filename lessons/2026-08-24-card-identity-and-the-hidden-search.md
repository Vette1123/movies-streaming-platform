# A card is not its id, and a control below the fold does not exist

Date: 2026-08-24
Area: `lib/match-night.ts`, `app/match-night/page.tsx`,
`components/match-night/{swipe-deck,deck-search,match-panel}.tsx`

## What

Two fixes to the Match Night room, both found by driving it on a phone-sized
viewport rather than by reading the code.

- **Card identity is `mediaType:id`, never `id`.** TMDB numbers films and
  series in separate namespaces, so 1399 is both a film and a series. Every set
  and map in the room keyed on the bare id: `dedupeCards`, the decided-swipes
  set, the liked-cards map the match panel resolves posters from, and the
  queued-ids set the search greys rows out with. A collision silently dropped
  one of the two titles from the deck and could resolve a match to the other
  one's artwork. `cardKey()` is now the one place that decides, and
  `resolveMatches` (which already built the same string by hand) uses it too.
- **A "Search a title" chip on the meta line under the deck.** The search
  lives in the sidebar, which on a phone is one flick BELOW the actions - so on
  the screen where you run out of ideas there is nothing that says search
  exists. The chip scrolls to the field and focuses it. The drag hint moved to
  its own wrapped line: worth teaching once, not worth the widest slot on the
  tenth card.

## Mistakes

**The id collision was written three more times after the first one.** Four
separate id-keyed collections, each one added in a different sitting, each
copying the shape of the last. The DRY rule is not only about lines of code:
`new Set(x.map(c => c.id))` is a decision about identity, and repeating a
decision is how it stays wrong in four places at once.

**"I can't search anything" was answered by building search, and left there.**
The feature shipped into the sidebar, which is correct on a desktop and
invisible on the device the complaint came from. Shipping the capability is
not the same as shipping the way in.

**The room cannot be exercised under `pnpm dev` at all** - `/api/*` is the
Worker, and Next dev has no route for it, so the deck is empty and half the UI
never renders. Two verification attempts were spent on a dev server before
that registered. It is `pnpm build:cf` + `wrangler dev`, and the build fails
with `EBUSY: rmdir 'out'` unless the previous `wrangler dev` is killed first.

## What worked

- Keying by `mediaType:id` costs one helper and is now impossible to get wrong
  in a new caller, because the type of every one of those sets is `Set<string>`
  and an id does not type-check.
- The regression test is two lines: dedupe `[movie 1399, tv 1399]` and expect
  both to survive.

## Rules

- Identity of a TMDB entity is `type:id`. A bare id is only unique inside one
  media type.
- When the same derivation appears twice, extract it before writing the third -
  a repeated decision is a bug with N copies, not N lines of duplication.
- Verify a feature on the viewport its complaint came from. Discoverability is
  part of the feature, and it is layout-dependent.
- Anything in this repo that calls `/api/*` is only testable against
  `wrangler dev` over a real `build:cf` output.
