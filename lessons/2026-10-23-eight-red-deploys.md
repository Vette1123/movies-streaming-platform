# Eight red deploys

## What

Every Deploy run from `feat(ui): empty-state polish` onward failed at `next build`
(8 in a row, including the 6h cron, so prod sat on a ~day-old build):

- `app/watchlist/page.tsx` called `useState`/`useCallback` while exporting
  `metadata`, so it had to stay a server component and could not hold hooks.
  The export/import controls moved to `components/watchlist/watchlist-transfer.tsx`.
- `components/media/ratings-strip.tsx` (a server component, on purpose: the
  scores must be in the prerendered HTML) called the new `useCountUp` hook.
  The animated number is now a client island, `components/media/count-up-number.tsx`.

The dev server then surfaced bugs that the build had let through:

- `.group-hover/card.card-gradient-border::before` in `globals.css` is not a
  valid selector (`/` unescaped). Turbopack dev 500'd **every page** on it.
  The production build accepted it, so it shipped as a dead rule.
- The gradient border had only `-webkit-mask` (no standard `mask`), rotated
  the whole pseudo-element (corners swing outside the card), and sat at
  `z-index: 0` under the poster, so it could never be seen.
- `useCountUp` seeded state from `matchMedia`, which is a hydration mismatch
  for reduced-motion users.
- The count-up always landed with `toFixed(1)`, so Metacritic's 67 read "67.0".
- The watchlist offered Import only when the list was non-empty, which is
  exactly when you do not need to restore a backup.

Also upgraded 8 packages to latest (framer-motion, lucide-react, posthog-js,
react-query, wrangler, postcss, @posthog/nextjs-config, @typescript-eslint/parser).

## Mistakes

- Eight UI commits were pushed on green typecheck + lint, and nobody looked
  at the Actions tab. Neither check can see a hook in a server component; only
  the build can.
- `pnpm build` passing was taken as proof that the CSS was fine. It was not:
  prod tolerated the bad selector while dev refused it. The gradient border
  had never once been seen working.

## What worked

- `gh run view <id> --log-failed` named both files in the first read.
- Opening the app in dev, after the build passed, found four more bugs.

## Rules

- After pushing, check the Deploy run. A red cron means prod is frozen.
- `tests/build-only-errors.test.ts` guards both blind spots (client hooks in
  server route files and the ratings strip; unescaped `/` in globals.css
  selectors). Add a file to `EXTRA_SERVER` when a server component outside
  `app/` must stay server-rendered.
- A visual effect is not done until it has been seen on screen. "The rule
  exists" is not the same as "the rule paints".

## Follow-up: dangling source-map comments

The PostHog upload deletes the .map files but, in Turbopack debug-id mode, leaves
`//# sourceMappingURL=` behind (24 of 25 live chunks pointed at a 404). `scripts/strip-map-comments.mjs`
now runs in `build:cf` after the export and drops only comments whose map is absent;
the `debugId` PostHog matches on stays. The plugin has the same stripper, but it is not
in its `exports` map, so a deep import would break on upgrade.

## Follow-up: the batch that went live with the fix

Unblocking the build shipped all 16 UI commits at once, none of them ever
seen running. On prod: 58 animations at once on the homepage, the hidden
`<h1>` printed across the header, and the details-page actions pushed 2,400px
down. Kept every enhancement; fixed the cause of each:

- details hero: the parallax wrapper was `relative size-full` IN FLOW, so it
  took a full 100svh and the copy rendered below it. Back to the absolute
  backdrop; parallax + pointer spotlight dropped (a React re-render and a
  full-screen gradient repaint per mousemove).
- magnetic buttons: `window` mousemove with no distance cap (a far cursor
  dragged buttons ~200px) plus a rAF loop per button forever. Now element-only,
  clamped to strength/2, CSS transition, no loop.
- card tilt fought framer's lift on one transform: moved to its own layer
  with `perspective()`.
- card border animated on every card at opacity 0: now only while hovered.
- shared-element transition: names were on every card, and a title in two
  rails gives a duplicate name, which makes Chrome skip the transition. Named
  on click only.
- hero copy entrance hid the copy until hydration and slid the Watch button:
  no entrance on first paint, fade-only for the action row. The glass panel
  (no padding, full-size backdrop-blur) and the roaming `.hero-glow` are gone,
  and the first-paint title grace that was deleted is back.
- scroll reveal held sections at opacity 0 until JS: now a CSS scroll-driven
  animation that shows the content wherever unsupported.
- phones: aurora and stars kept (that was the ask) but static.
- Watch pulse: 3 breaths, not infinite.

`tests/hero-motion-budget.test.ts` pins these.

### Mistake (mine)

I fixed the build and pushed without opening the pages it deployed. A build
fix that unblocks a queue of unreviewed commits IS a release of those commits.
Check every page that queue touched before pushing the fix.

## Follow-up: still 46% GPU, a morphing transition, late title and badge

- The 46% was not last night's work: the site-wide aurora (two 58vw blobs
  under blur(70px) roaming, two star layers at 170% of the viewport drifting
  and twinkling) composited ~10 screens of pixels per frame on every page.
  Now static everywhere, no blur filter, stars at viewport size. Same look.
- The poster-to-backdrop morph drew the poster's own transition group above
  the whole page, squeezing a portrait thumbnail into a full-screen backdrop
  over the hero. Removed; the designed 200ms crossfade (DetailsPageTransition)
  is what was meant to run.
- "New" badge waited for full hydration (mount gate). Judged against the
  BUILD's clock instead (next.config pins NEXT_PUBLIC_BUILD_TIME before the
  render workers fork), it is in the server HTML with no #418 risk.
- Hero ratings: the row dropped TMDB and needed two sources, so every new
  release (most hero slides) had none. One source is enough now.
- Hero/page seam: both heroes end in the page colour; a static strip below
  fades it into the backdrop. A hidden-tab zoom that downsamples shows a
  "line" that full resolution does not — check seams at 1:1.

### Mistake

"Fix the GPU" was answered with last night's diff only. Measure the idle page
first (`document.getAnimations()` running count): the biggest cost was older
than anything in the diff.
