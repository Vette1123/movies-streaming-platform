# The h1 lived under a season select, and every phone rating was invented

## What

Detail-page pass on `/movies/[id]` and `/tv-shows/[id]`: mobile type hierarchy,
series stack order, a false certification chip, and three SEO corrections
(series `og:release_date`, tail-page skeleton height, JSON-LD `inLanguage`).

## Mistakes

- The series row used `flex-col-reverse` so the poster would sit *after* the
  synopsis. Reversing the whole column also put the season navigator (last DOM
  child) *above* the h1 — the page's only heading rendered under a `<Select>`
  on every phone. The fix is `order-*` on each child with `md:order-0`, not a
  direction flip. The error-boundary wrapper for that aside needs the same
  `order` class: it renders `children` bare on the happy path, so the class on
  the inner `<aside>` alone is not enough when the island fails.
- Every non-adult title was showing a `PG-13` chip (adult → `NC-17`). TMDB's
  detail payload has no certification; the chip was pure invention on ~2,000
  pages. Removed rather than "fixed" — no data, no claim.
- The tail-page skeleton reserved `70vh` against a hero that is `100svh`, so
  every Worker-assembled detail page shifted ~30% on hydration.

## What worked

- Shared layout component (`DetailsExtraInfoLayout`) meant one type-scale edit
  covered movie *and* series, including the fallback shell.
- `order-3` on `NAVIGATOR_BOX` kept the Suspense fallback and the real
  navigator claiming the same mobile slot — same constant, same box.
- Impeccable detector on the ten changed files returned `[]`; lint, prettier,
  and all 434 tests green without a second pass.

## Rules

- Never reverse a multi-child column to reposition ONE child — use `order-*`,
  and put the order class on every element that can occupy that flex slot
  (including error-boundary fallbacks).
- A metadata chip needs a field in the payload. If the API does not ship it,
  render nothing.
- Skeleton height must match the settled hero (`100svh`), not a guessed `vh`.
