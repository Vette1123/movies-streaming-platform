# The Reely Player outage nobody's alarm caught

## What

From 2026-11-07 the Reely Player failed on about 80% of plays (29 of 36
resolves were 502 over 48h). The provider's playlist mint, `generate.php`,
began requiring the player page's `apiToken`, and the relay called it bare.
Fixed in reely-resolver-relay #3. Its errors now quote short provider refusals
(#4). This repo gained `pnpm relay:canary` and an hourly workflow
(`.github/workflows/relay-canary.yml`). Each run checks the ticket endpoint,
the player shell, and three titles walked through the relay's `/selftest` to
a real segment. It opens one `relay-down` issue on failure and closes it on
recovery.

## Mistakes

- The relay has had `/selftest` since September, and nothing ever called it
  on a schedule. The outage ran about a day and was reported as "wtf", not
  by any monitor.
- I planned to make the player Worker log the relay's failure detail. The
  relay's own comments already say a Worker never sees a 5xx body from it
  (Cloudflare substitutes "error code: 502"), so that log would have printed
  nothing. I dropped it before writing it. The canary reads `/selftest` from
  GitHub instead, where the body arrives.
- My first production probe spent this IP's free daily title, and the second
  was refused. Re-using the same title works, because the trial is per title.

## What worked

- Workers Logs on the player, grouped by status: 502 on 29 of 36 calls
  pinned the failure to the relay in one query.
- Replaying the provider walk hop by hop, stopping at the first non-200.
- Proving the canary red by pointing `RELAY_URL` and `PLAYER_URL` at dead
  paths before trusting it green.

## Rules

- A dependency we scrape will break. The bar is knowing within the hour
  with the broken hop named, not "never".
- A canary must not spend what users spend. The ticket check sends `{}`,
  which fails validation before any trial is touched.
- One title vanishing upstream is not an outage. The verdict fails only
  when most titles fail.
