# SEO finish: sameAs, a lighter /people, genre hub links, manifest alias

## What

- Movie and TVSeries JSON-LD carry `sameAs` (TMDB always, IMDb when the payload has a real `tt` id); Organization carries a support `contactPoint`.
- `/people` tiles use one fixed 320px URL (`hubPortraitSrc`) instead of a 13-width srcset per tile. In production the srcset was 1.5 MB of the 2.87 MB page; the dev page now has 0 srcsets.
- `/movies` and `/tv-shows` gained a "By genre" row next to "By year". Before it, none of the 35 genre hubs had a link from either browse page. Both rows share one `HubLinkRow`.
- `/manifest.webmanifest` and `/manifest.json` 301 to `/site.webmanifest`, in `_redirects` and `next.config.mjs` alike.

## Mistakes

- The earlier audit said production `/movies` had no year links either. A curl showed 8 of them; the miscount came from grepping the wrong path pattern. Re-measure before building: the row only needed genres added.
- The first test passed `title` to `tvSeriesJsonLd`; the series input field is `name`. Vitest ran green anyway, and only `pnpm typecheck` caught it. Run the typecheck on test files too.

## What worked

- Red/green by saving `git diff` to a patch, checking out the four source files, running the test (6 of 6 failed), and re-applying with `git apply --include`. No stash involved.
- Blank `/people` tiles in a Claude in Chrome screenshot were decode lag in the hidden tab: `complete`, `naturalWidth 320`, opacity 1. A zoom screenshot then showed them.

## Rules

- A very long grid of images gets one fixed URL per tile, never next/image's full srcset.
- Every hub family (genre, year, people) needs a prerendered link from the page that owns it.
