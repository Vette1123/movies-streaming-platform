# Both app ads in the footer

**Date:** 2026-10-31
**Area:** `components/app-promo.tsx`, `lib/promo.ts`

## What

The footer strip now shows Masareef and Rafiq on every page, Masareef first. `pickPromo`
is gone: `AppPromo` maps `PROMOS`, side by side from `lg`, stacked below it. Each app
reports its own `promo_shown` when it scrolls into view, so stacked ads are not counted
together.

## Mistakes

The per-route rotation shipped hours earlier on a premise nobody had checked: "one footer
slot". The strip was a full-width row with room for two. Its hash, route test and lesson
rule were all thrown away.

`pnpm install --frozen-lockfile` in the new worktree rewrote `pnpm-lock.yaml` with the same
25 lines `1886cc9` reverted. It stayed out of this commit; the cause is still unexplained.

The first browser load hit a dev server that was not up yet, and the tool reported the
error page as a browser-internal URL.

## What worked

- Same-origin iframes for narrow widths: the Chrome window would not resize, and a
  fixed-width iframe applies the real breakpoints.
- Copy replaced with Arabic and long strings inside the iframe, without touching the code.

## Rules

- Before building a picker for a slot, measure whether the slot really holds only one.
- The order in `PROMOS` is the order on screen, and the test pins it.
