# Sponsor README line ends itself, GitHub Sponsors everywhere (2026-11-13)

## What

Ported from social-media-downloader the day its first paid month sold: the card
already ended through `from`/`until`, but the README line `/advertise` promises
had no end at all. Added dated README markers, `scripts/expire-sponsors.mjs`
(`pnpm sponsors:expire`), a daily `.github/workflows/expire-sponsors.yml`,
`.github/FUNDING.yml` for the repo's Sponsor button, and the GitHub Sponsors link
in the README and on `/advertise` (a fixed month is paid once through it).

## Mistakes

- The first survey went to `reely-pro-player`, the private player Worker, on the
  name alone. Reely the site is this repo.
- The README said "In the slot now: Masareef ... until a sponsor books it", a line
  that turns false the moment a booking goes live. Reworded to "When no sponsor
  is booked", which stays true, with the sponsor's dated line under it.

## What worked

- Reusing the shipped script and test verbatim (paths only), not rewriting it.

## Rules

- Every paid README line sits between `<!-- sponsor:<id> until=... -->` markers.
