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
