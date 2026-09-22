# Airing chip on the detail hero

## What

Feature 5 of the five-killer-features pass: a chip in the series detail badge
row — "Ars today" / "Airs tomorrow" / "Airs in N days" / the date — driven by
`SeriesDetails.next_episode_to_air.air_date`. Pure label logic in
`lib/airing.ts` (`airingLabel`), mount-gated chip in
`components/airing-chip.tsx`, mounted beside `NewBadgeWhenRecent` in the
already-reserved `min-h-7` badge row.

## Mistakes

- First draft formatted far dates with `toLocaleDateString()` in the label
  function — locale-dependent output is a hydration mismatch waiting to happen
  and disagrees with every other date on the site. Switched to the shared
  `dateFormatter` (en-US, UTC-pinned), the same helper the cards and heroes
  already use.
- Almost rendered the chip from `Date.now()` during render without a mount
  gate. Same class of bug as `NewBadgeWhenRecent`: server HTML frozen at
  prerender time vs client clock can disagree and trip React #418. The chip
  goes through `useMounted` for exactly that reason — do not inline
  `airingLabel` in a non-gated component.

## What worked

- Reusing the badge row that already reserves `min-h-7`: no new layout box, no
  new CLS surface, and the two mount-gated chips sit in one flex row with
  `static` so they don't fight the base `absolute`.
- Day-math on UTC midnight (floor both sides, then round the difference),
  copied from the upcoming panel's `whenLabel` — not a raw ms comparison, which
  would call a 6-hour-out episode "tomorrow" for half the planet.
- Past / empty / unparseable dates all return null: a finished series must not
  grow a chip claiming something already aired is "today".

## Rules

- Any label that depends on `Date.now()` or the visitor's locale is
  mount-gated and uses `dateFormatter` (or another pinned formatter), never
  bare `toLocale*`.
- Air-date arithmetic is calendar days on UTC midnight, not elapsed hours.
- The chip reads `next_episode_to_air.air_date` only — no extra TMDB call; the
  field is already on the detail payload the page renders from.
