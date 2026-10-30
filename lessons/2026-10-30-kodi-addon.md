# Kodi add-on and device sign-in

## What

A supporter-only Kodi add-on (`kodi/plugin.video.reely`), device-code sign-in at
`/link` on top of the existing `sessions` table, and bearer tokens on
`/api/pro/ticket`. Companion fix in `reely-resolver-relay`: segments named `.ts`.

## Mistakes

- Told the user "Pro only" was enforced without checking. `PRO_PLAYER_OPEN` is `"1"`
  in `wrangler.jsonc`, so the ticket route serves anyone and the limit lives in the
  browser. Removing it would kill the free trial, so bearers are gated instead.
- Every HTTP hop returned 200, which read as "Kodi will play this". Stock ffmpeg
  refused every segment, because the CDN disguises them as `.html`.
- Called `bearerOf` in `worker.js` without importing it. Nothing failed: vitest does
  not load the Worker, and it would have crashed ticket minting for every player.
  Caught by reading the diff.
- Imported the code validator from `device.ts`, which would have pulled server
  session code into the client bundle. Split into `device-code.ts`.
- `text-2xl` on the code field rendered at 14px because `Input` carries
  `md:text-sm`. Only a browser showed it.

## What worked

- Probing the chain as Kodi would (no Origin, no Referer, plain UA) before writing a
  line, then proving it with `ffmpeg -f null -` rather than status codes.
- Reusing `sessions` for the TV token: expiry, the cap and sign-out came for free.
- Running the real migration on `node:sqlite`, so `DELETE ... RETURNING` is tested.

## Rules

- A stream is proven by a decoder, not a 200.
- Read `wrangler.jsonc` vars before stating what is enforced.
- `worker.js` has no test harness: a new identifier there gets checked by eye.
