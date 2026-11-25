# The health gate sampled the one title the vault refuses

## What

Reported as "Reely Pro is not working". It was down site-wide, and the relay was fine.

`/api/stream/health` answered `{"up":false,"reason":"segment 429"}` and
`POST /api/pro/ticket` answered **503 relay-down for every title** — so no
supporter and no trial could reach the player at all. `pnpm trial:probe` failed
on step 1 for the first time.

The gate walks ONE title to decide whether the player is offered
(`HEALTH_QUERY`, `scripts/lib/relay-selftest.mjs`). That title was Fight Club
(550), which is also the canary's deliberate **degradation witness**: it mints
to the mbVault family (`bcdnxw.hakunaymatata.com`) whose Range reads this
chain's egress gets 429 from. Measured today, both homes:

| Title               | Vault family | Master            | Segment |
| ------------------- | ------------ | ----------------- | ------- |
| 550 Fight Club      | mbVault      | file, `text/html` | **429** |
| 155 The Dark Knight | mwVault      | file, `video/mp4` | **206** |
| 27205 Inception     | mwVault      | file, `video/mp4` | **206** |

The canary already knew this shape and called it "playing (degraded)": one
refused title is not an outage. The gate did not share that rule, so one
title's refusal became an outage for all of them. The probe title was chosen
back when 550 was "long-running and widely carried"; when the vault moved it
to the refusing family, the gate silently pinned the whole player off.

## Fix

- `HEALTH_QUERY` is now derived from a shared `TITLES` list: the first title
  that is **not** the degradation witness (155 today). The canary imports the
  same list, so the gate and the witness can never be the same title again.
- `relayUp` treats `vaultRefused` as up, matching the canary's own verdict:
  the walk resolved, the title is carried, only this egress's byte proof was
  refused. Other titles still play; refusing them all is strictly worse.
- `relay-front-verify` probed 550 too, so its "byte path" check was failing
  on the refusing family for the same reason. It now probes 155.
- Tests pin both: a vault-refused answer is up, and the gate's query is never
  the witness (and is still a title the canary walks).

## Mistakes

- The gate and the canary read the same helper and the same `/selftest`, but
  the canary's per-title nuance (degradation vs outage) never reached the
  gate. Sharing a parser is not sharing a verdict.
- "Long-running and widely carried" was a claim about the catalog, not about
  the byte path. The vault family is per title and can move; a single-title
  gate needs a title chosen for the family it is on, and a rule for when that
  family is the refusing one.
- The canary's headline said "playing" while the site said "down", and nothing
  compared the two. The canary checks the relay and the player; it does not
  check the site's own gate answer.

## What worked

- `pnpm trial:probe` named the break in one step: `FAIL 1. mint the no-stream
  title — 503`. That is the end-to-end path a supporter takes.
- Fetching `/api/stream/health` from the browser (the WAF challenges curl) and
  then walking all three canary titles against both homes: the table above took
  one command and separated "relay down" from "this title refused".
- Checking `relayUp` against the canary's `vaultRefused` before writing code:
  the right semantics already existed one function away.

## Rules

- **A health gate is a sample. Sample the family that serves, and say what a
  refusal means.** Never point a global gate at the title kept as the failure
  witness.
- **When a canary and a gate read the same answer, they must share the verdict
  too** (`relayUp`), not just the parser (`selftestPassed`).
- **A 429 segment with a resolved file master is degradation, not downtime.**
  Blocking every title because one is refused turns a known partial failure
  into a total one.
- **Probe scripts must use a serving-family title**; a probe on the witness
  reports a false outage on every run.
