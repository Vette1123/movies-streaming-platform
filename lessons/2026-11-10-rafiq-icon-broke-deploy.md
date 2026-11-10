# Rafiq icon broke the deploy

## What

`0a4a1ec chore(brand): Rafiq's new icon` went straight to main with a 19,283-byte
truecolour `public/promo/rafiq.png`. `tests/app-promo.test.ts` caps promo icons at
10 KB, so the Deploy job stopped at `pnpm test` and production stayed on the
previous build. Fixed in #173 by quantizing to a 256-colour palette with sharp
(5,909 bytes, no visible difference at 96x96).

## Mistakes

- An asset-only commit was treated as too small to test. The suite covers asset
  budgets too, so a binary swap is a test-relevant change.

## What worked

- Reading the failed step's log first: the assertion named the file and the byte
  count.
- Shrinking the asset instead of raising the budget; the 10 KB cap is the
  intended guard.

## Rules

- Run `pnpm test` before pushing any change, image swaps included.
- Promo PNGs: `sharp(f).png({ palette: true, colors: 256, effort: 10, compressionLevel: 9 })`.
