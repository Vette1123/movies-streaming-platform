# The fourth rating pill wrapped alone on a phone

## What

On a 390 px phone the detail hero's four rating pills (TMDB, IMDb, Rotten
Tomatoes, Metascore) need about 372 px and the row has 350, so Metascore sat
alone on a second line, with the overview text 8 px under it. Measured on live
before the fix: `/movies/27205` and `/movies/157336`, 4 items on 2 rows.

- Below `sm` the pills tighten (gap 1.5, padding 2.5/1.5, 18 px marks,
  `text-sm`); from `sm` up they are unchanged. The home hero uses the same
  `RatingsPills`, so it gets the same fit.
- The overview gets `mt-1` so it no longer touches the pills.
- `pnpm shots` now fails when a list marked `data-one-row` wraps from 375 px up.
  `RatingsPills` carries `data-one-row="rating pills"`.

## Mistakes

- The first visual pass called the tight gap "taste" and skipped the stranded
  pill entirely. A row that strands one item is a layout defect, and it was the
  cause of the tight gap too.
- The new check could not go red on live because the marker attribute was not
  deployed yet. The red came from a one-off probe selecting today's pills by
  their classes.

## What worked

- Counting distinct `top` values of a list's children is a one-line test for
  "this row wrapped".

## Rules

- A row meant to read as one line gets `data-one-row`, and `pnpm shots` holds it.
