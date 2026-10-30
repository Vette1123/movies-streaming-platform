# Reely Player paywall moved to the server

## What

`/api/pro/ticket` was open to anyone through `PRO_PLAYER_OPEN`, because the free
daily title lived only in localStorage. The rule now runs in
`lib/pro/ticket-access.ts`: supporters always, a linked TV only as a supporter,
everyone else one title in 24 hours from a `player_trials` row. `pnpm kodi:probe`
walks it on production, including the add-on's own code and an ffmpeg decode.

## Mistakes

- Reported the open endpoint as a known limit when shipping the add-on. A paid
  feature that anyone can call with no token is a bug, and the user said so.
- First plan removed the var from `wrangler.jsonc` and kept the check. `keep_vars`
  means a deleted var can live on in the dashboard, so the code had to stop
  reading it.
- The first gate ran before body validation, which would have spent a trial on a
  malformed request and turned the takedown 451 into a 402. It now runs last.

## What worked

- Testing the upsert on real migrations through `node:sqlite`. The race between
  two titles is a property of the SQL, and a mock cannot show it.
- Keying the signed-out trial on a keyed hash of the address, so no raw address is
  stored.
- The client already handled a refused ticket by falling back to the embed, so the
  browser needed no behaviour change.

## Rules

- A check the private worker relies on lives in one module with no flag around it.
- A `keep_vars` var is only gone once no code reads it.
- A probe that writes production uses ids no real row can have, and deletes what
  it wrote even when a step fails.
