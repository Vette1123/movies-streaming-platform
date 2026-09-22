# Spoiler-safe share cards

## What

Feature 1 of the five-killer-features pass: a second hero action that renders a
1080×1350 PNG of the title (art, title, year, genres, score — nothing else) and
hands it to the platform share sheet, or downloads it where files cannot be
shared. Shared canvas primitives (`lib/canvas-card.ts`) were extracted from
`lib/stats-card.ts` so both cards draw from one palette/`fitText`.

## Mistakes

- A `replaceAll` of `WIDTH` → `CARD_WIDTH` also hit the import line that had
  already been rewritten, producing `CARD_CARD_WIDTH`. Caught by reading the
  file back, not by a test — mechanical renames over a file you just edited need
  a read-back, not trust.

## What worked

- The spoiler constraint was pushed into the function signature (`ShareCardInput`
  takes only title/year/genres/rating/art) rather than asserted at the call site,
  so there is structurally nowhere for an overview to enter.
- Copied the `canShare({ files })` + download fallback + AbortError-only swallow
  from `stats-panel.tsx` / `hooks/use-share.ts` instead of inventing a third
  flow; `isDismissal` was exported rather than duplicated.
- `crossOrigin='anonymous'` on the art load, with an onerror→artless-card path,
  so a CORS miss degrades the picture instead of tainting the canvas and killing
  `toBlob`.

## Rules

- A canvas that will be exported MUST load its images cross-origin, or `toBlob`
  throws SecurityError — design the artless fallback first, it is the real path.
- Spoiler-safety belongs in what a renderer is allowed to read (its input type),
  never in a deny-list of fields to omit.
- `replaceAll` on a token you have just introduced in the same file will hit the
  introduction. Read the file back after a mechanical rename.
