# `pnpm apps:icons` finishes again; Masareef's icon is current

## What

`scripts/build-companion-icons.mjs` looked for every app at
`<slug>/assets/images/icon.png` and threw on Masareef, whose Expo app sits at
`masareef/masareef-app/`. Nobody re-ran it after that, so public/apps/masareef.webp
stayed the old full-bleed art while Masareef shipped its new icon ("pick E").
`scripts/lib/companion-icon-source.mjs` now tries both layouts and the error
names every path tried. Regenerated: Masareef's icon is the current one;
Rafiq and Nafis are the same art, re-encoded.

## Mistakes

- Found while porting this script to Social Downloader, not here: a script that
  throws on one input and is only run by hand fails silently for months.

## What worked

- A pure path helper with an injectable `exists`, so the test covers both
  folder layouts without the sibling repos on disk. Seen red on the old one-path
  logic (2 of 3 failed), green with the fix.

## Rules

- An asset script reads layouts it does not own; probe candidates and print
  which path it took.
