# Tonight's triple spinner

## What

Feature 4 of the five-killer-features pass: a "Tonight's triple" band at the top
of `/watchlist` that picks three saved titles for one evening, shows each
runtime and a total, and offers a **Spin again** control. Selection is pure
(`lib/watchlist-triple.ts`), seeded by day (UTC at first; local since 2026-09-23) so the default triple is stable
while you navigate; the spin control is just `daySeed() + spins`.

## Mistakes

- First sketched the picker with `Math.random()` inside the component — that
  makes the triple change on every render and disagrees between server and
  client. Moving the seed to an argument (day number + spin count) is what
  makes "stable by default, reshuffle on demand" one code path instead of two.
- Nearly gated on `watchlist.length >= 3` in the parent before mounting the
  component; the pure function already returns `[]` for short lists, so the
  component's own `triple.length < 3` guard is enough and keeps the empty
  watchlist path to a single null return.

## What worked

- Reused `MINUTES_PER_EPISODE` / `MINUTES_PER_FILM` from `lib/stats.ts` (now
  exported) instead of restating 42/115 — the stats page and the triple must
  not disagree about what an un-runtimed row costs.
- Two-pass pick: prefer the seed's own top three when they fit
  `EVENING_MINUTES` (180); if not, the three shortest (stable sort keeps seed
  order among equals); if still over, the seed triple with the overrun shown in
  the total line. A triple that overruns is still a triple — the number is
  visible rather than hidden.
- Mount-gate + `useMemo` on `isMounted` keeps hydration deterministic: server
  and first client render both see `null`.

## Rules

- A "pick for me" control is a pure function of `(items, seed)`; never call
  `Date.now()` or `Math.random()` inside the picker.
- Runtime fallbacks live in one place (`lib/stats.ts` constants) so every
  hours/minutes figure on the site shares the same averages.
- Prefer a set that fits the stated budget when one exists (seed top-three
  first, then shortest-three); do not silently return fewer than three when the
  list has three or more.
