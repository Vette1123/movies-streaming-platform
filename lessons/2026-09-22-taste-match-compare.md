# Taste match compare

## What

Feature 3 of the five-killer-features pass: `/compare?a=<handle>&b=<handle>`
lines up two public profiles' rated-highest titles — shared, unique per side,
and a Jaccard percentage. Pure computation in `lib/profile/match.ts`; the page
fetches the same `/api/profile/<handle>` payload the profile shell already
draws. Entry point: a "Compare taste with a friend" button on `/u/<handle>`
prefilled with `?a=`.

## Mistakes

- First draft of the missing-profile message called a `pairLabel(result, side)`
  helper that ignored its arguments and always rendered an empty string — the
  failure path would have printed `@ has no public page`. Caught by reading the
  file back before commit; the handles belong on `CompareResult`, not in a
  lookup after the fact.
- Considered a genre-overlap score before checking what a profile actually
  carries: `topRated` has no `genre_ids` (the reviews payload never stored
  them). A genre score would have meant one TMDB `external_ids`/detail lookup
  per row per side — the free-plan subrequest pattern IMDb ratings already got
  banned for. Title overlap is the honest ceiling of the data that exists.

## What worked

- Zero new backend surface: `ROUTES` untouched, no Worker branch, no migration
  — two client GETs and a pure function, the same shape as F1's share card.
- Query params read on mount and written with `history.replaceState`, copied
  from `/mood`: `useSearchParams` would bail the exported route to CSR, and the
  h1 has to be in the prerendered HTML.
- Keys are `type:id`, not bare TMDB ids — movie 603 vs series 603 is a test
  case, not a theoretical one.

## Rules

- A compare of two public records is a client computation over two existing
  reads; reach for a new endpoint only when the pair is too big for the wire or
  needs a secret.
- Score the Jaccard union, and return 0 for two empty shelves — 100 would read
  as perfect alignment between two people who have rated nothing.
- Never invent a dimension the payload does not carry; check the DTO for the
  field before designing around it.
