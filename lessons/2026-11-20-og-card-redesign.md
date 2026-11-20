# The share card, redrawn, and its alt text brought under the copy rule

## What

Rebuilt `public/opengraph-image.png` from `app/_og/source.tsx`: brand mark,
"Find what to watch. / Then keep track.", and a drawn product scene (a fanned
poster stack with a rating, an "Up next" progress card and an "Added to
watchlist" toast). The posters are drawn gradients, not TMDB art. Every page now
shares one `SITE_CARD` object (`lib/og/share-image.ts`) carrying width, height,
type and alt, instead of a bare path. The Inter subsets cover printable ASCII at
500/700/900, so new copy no longer needs a glyph-string edit.

## Mistakes

- The launch kit's copy rule was applied to the card in August, but not to its
  alt text. `app/layout.tsx` kept shipping "Watch movies & TV shows free…
  and stream" as `og:image:alt` on every page for three months. The first fix
  covered the pixels and stopped there; the alt is the same copy in another field.
- 14 pages passed `'/opengraph-image.png'` as a string, so no page outside the
  root layout had an alt, width or height. A string looks complete in review.
- The font subsets held only the card's own letters, so every copy change was
  one forgotten `pnpm fonts:og` away from blank glyphs.
- Running `pnpm icons:build` to prove the font change re-encoded every icon
  with new bytes. Those outputs were restored, not committed.

## What worked

- Rendering, then looking at the PNG at full size after each change. The first
  render wrapped "watch." onto its own line and the Up next card hit the badge.

## Rules

- Card copy lives in `OG_COPY`; `tests/og-card.test.ts` checks it and the alt
  against the banned phrases and the glyph set.
- Use `SITE_CARD`, never the bare path (also tested).
