# The crawler block was hydrated away

## What

Search Console: 609 URLs under "Duplicate, Google chose different canonical than
user" (488 recent; it picked /tv-shows/65711 as the canonical for /movies/24238),
and 44 `/person/<id>` 404s. Bing: 6 errors, all 404.

- **Duplicate canonical.** Every Worker tail page threw React #418 on hydration,
  in production and in Google's own render. The Worker prepends its crawler block
  to `<body>` as a `<div>`, and the shell's first body child is Next's
  `<div hidden>`. React 19 skips a body node whose tag differs from the one it
  expects but claims one whose tag matches, so it took the SEO div for Next's,
  hit the mismatch, and re-rendered the root from scratch. That deleted the block.
  Google's render then held only the loading skeleton, the same on every tail id,
  so it treated them as duplicates of each other. The block is an `<article>` now.
  Verified on `wrangler dev` against the real build: no #418, and the block and
  the full page are both there after load, on a movie and a TV tail.
- **Person 404s.** 20 of the 44 ids were missing from `data/people.json`, plus 3
  more from Bing. All were added. `refresh-people.mjs` used to trim hand-named ids
  with the same cap as the catalogue, so a file already at the cap dropped them
  without a word. They are always kept now (`scripts/lib/people-set.mjs`), and the
  script fails if the projected file count passes 20,000. 787 people, about
  18,003 files.
- The 3 movie/TV 404s on Bing are titles TMDB deleted. That is correct as it is.
- `next.config.mjs` roots Turbopack at the real `node_modules`, so a worktree can
  build.

## Mistakes

- Suspected the pathname-dependent components (`SiteSponsorSlot`, nav) first,
  because the shell is exported at `/media-fallback` and hydrated at `/movies/<id>`.
  `pagePlacement` gives null for both paths, so it was never that. Comparing the
  first bytes of `<body>` in the served page against the exported shell would
  have found it in a minute.
- Concluded from React's source that "mismatches inside the body singleton are
  skipped", so the prepended block could not be the cause. Only mismatched TAGS
  are skipped. A matching tag is hydrated.
- `pnpm people:refresh --only 1,2,3` matched no ids and printed "0 by hand" as
  though it had worked. Ids can now be separated by commas or spaces, and anything
  else fails.

## What worked

- Reproducing on `wrangler dev` over a real `build:cf` output instead of reasoning
  about minified production stacks.
- Rebundling only the Worker (`node scripts/build-worker.mjs`) after the fix,
  without a second full build.

## Rules

- Anything the Worker injects into `<body>` must not use the tag of the shell's
  first child (`div`). `tests/fallback-seo-block.test.ts` pins this.
- To check a fallback page, read `document.querySelector('[data-fallback-seo]')`
  AFTER hydration. Raw HTML containing the block proves nothing.
