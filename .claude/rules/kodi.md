---
paths:
  - 'kodi/plugin.video.reely'
  - 'kodi/tests'
  - 'app/kodi/page.tsx'
  - 'scripts/build-kodi-zip.mjs'
  - 'scripts/kodi-probe.mjs'
---

### Kodi add-on

`kodi/plugin.video.reely` is a supporter-only add-on (Kodi 19+; Vega OS Fire TVs cannot run Kodi). A TV signs in by device code at `/link`, and its token is an ordinary `sessions` row sent as a bearer (`lib/auth/device.ts`). Embeds can never play in Kodi, so it only reaches the Reely Player. `pnpm kodi:probe` proves every path against production. See `docs/kodi.md`.

**`/api/pro/ticket` is the Reely Player's paywall, and `lib/pro/ticket-access.ts` is all of it**: a signed ticket is the only thing the private worker asks for. Supporters always pass, a linked TV must be a supporter, and everyone else gets one title in 24 hours from a `player_trials` row (by account, or a keyed hash of the address when signed out). `lib/player-trial.ts` only decides what the browser offers. A trial is taken at mint, so a boot that finds no stream gives it back through `/api/pro/trial/release` (`releaseTrial`): only the holder of that title's trial, and only on a definite `stream: false` from the player worker's `/api/stream/availability`. There is deliberately no flag: `keep_vars` in `wrangler.jsonc` means a removed var can survive in the dashboard, so the old `PRO_PLAYER_OPEN` switch was removed from the code, not just the config.
