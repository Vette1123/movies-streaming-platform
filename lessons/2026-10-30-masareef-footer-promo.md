# Masareef promo in the footer

**Date:** 2026-10-30
**Area:** `components/masareef-promo.tsx`, `components/store-link.tsx`, footer

## What

A slim cross-promo strip with the Masareef logo above the footer grid on every page.
It reuses `StoreLink` (new `onOpen` prop) and the apps module, serves an 80x80 local
icon, and reports `promo_shown` / `promo_click` through `trackFeatureUsed`.

## Mistakes

`basis-56` dropped the text under the icon at 320px and left dead space beside it;
`basis-40` keeps them side by side. My first check for that compared element tops,
which can never match on a centred row, so it reported a false failure.

`pnpm exec` rewrites `pnpm-lock.yaml` in a fresh worktree on pnpm 12. Revert it before
every commit.

## What worked

- Testing narrow widths inside a same-origin iframe, because this browser has no
  mobile viewport.
- Removing the strip in the frame to prove the 200% page overflow was already there.

## Rules

- `outcome` on `trackFeatureUsed` is a closed union, so placement travels as its own
  `placement` property.
