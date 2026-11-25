# Two tests timed out on Windows, not in CI

## What

The 25 Nov sweep ran `pnpm test` and 2 of 1,405 tests failed with the 5 s timeout, even
when the suite ran alone. CI (Linux) was green.

- `pro-by-email` "no tracked file outside history names it" took 9.8 s. It read every
  tracked file with `readFileSync` and skipped binaries by extension, but its list had no
  `.mp4` or `.wav`, so it decoded 31 MB of films and audio (`docs/films/`, `video/public/`)
  as UTF-8. It now runs `git grep -l -I -i -E`: `-I` skips binaries by content and the
  history pathspecs replace the regex. The file takes 0.4 s. A second test checks that the
  scan does find "Reely Pro", so a broken pathspec can't pass vacuously.
- `kodi-addon` spawns `python3 -m unittest`, which takes 0.6 s from a shell and 12.6 s
  while vitest starts 158 workers. It gets a 30 s timeout.

Same sweep: cf:health was red on 81 eyeball 5xx in 24 h, and Bing's 24 Nov crawl counted 39
5xx. Both came from the hours the Chrome/131.0 fleet block fixed
([2026-11-25-chrome-131-burst-fleet](2026-11-25-chrome-131-burst-fleet.md)). In the 9 h after
the block: 1 of 47,656 eyeball 5xx and 0 crawler failures. Nothing more to fix.

## Mistakes

- The sweep first ran this suite at the same time as social-media-downloader's, which added
  a third timeout (`router-cache`) and made a fourth test fail in another repo. A suite run
  alone is the only reading that counts.
- An extension allowlist for "binary" files rots as soon as a new kind of asset is
  committed. Let git decide what is text.

## What worked

- Timing the Python suite outside vitest (0.6 s) separated "the test is slow" from "the
  spawn is slow under load".

## Rules

- A test that scans the repo uses `git grep`, never a `readFileSync` walk over `git ls-files`.
- A test that spawns an external interpreter sets its own timeout.
