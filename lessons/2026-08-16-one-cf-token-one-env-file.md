# One Cloudflare token, one env file

**Date:** 2026-08-16
**Area:** Cloudflare API token scope, local env layout (`.env.local` / `.dev.vars`)

## What

Two Cloudflare API tokens existed, each able to do about half of what this repo's
scripts need, and two local secret files existed for the same reason. Both were
collapsed to one of each.

- **Token.** `reely-waf-setup` could reach zones, rulesets, DNS, zone settings and
  bot management but got `403` on `workers/domains/records`, `workers/subdomain`,
  D1 and KV — so it could run `waf:apply` / `dns:harden` / `cf:health` and purge,
  but could not `wrangler deploy` (custom-domain routes need Workers Routes,
  and the new accounts work needs D1). `Edit Cloudflare Workers` was the inverse:
  the Cloudflare template, deploy-capable, no DNS or ruleset access. Replaced by
  one custom token scoped to the single account and the single zone, with an
  expiry — both old ones were account-wide, all-zones and never expired.
- **Env files.** `.dev.vars` held 12 keys for the Worker under `wrangler dev`;
  `.env.local` held 14 for Next and the `cf-*` scripts. Five keys overlapped with
  identical values. The 7 Worker-only keys moved into `.env.local` and `.dev.vars`
  was renamed `dev.vars.bak`.

Permission set the scripts actually need — account: Workers Scripts Edit, Workers
Observability Read, Account Analytics Read, D1 Edit, Account Settings Read; zone:
Zone Read, Zone Settings Edit, DNS Edit, Cache Purge, Zone WAF Edit, Cache Rules
Edit, Transform Rules Edit, Workers Routes Edit, **Bot Management Edit**,
**Zone Analytics Read**.

## Mistakes

- **Probing endpoints is not the same as enumerating permissions, and the first
  permission list was wrong twice because of it.** A `GET` returning `200` proves
  read access to that one endpoint and nothing about the write scope or about the
  sibling endpoint a script hits three lines later. Two gaps got through: Bot
  Management (never probed at all in the first pass) and Zone Analytics Read.
  The second one is the instructive failure — the probe tested _Account_ Analytics
  via a GraphQL `workersInvocationsAdaptive` query, it returned real data, and that
  was taken as "analytics: covered". `cf-health.mjs` also runs a **zone**-scoped
  `httpRequestsAdaptiveGroups` query, which needs a different permission entirely:
  `com.cloudflare.api.account.zone.analytics.read`. Account analytics passing said
  nothing about it.
- **Running the actual script found in one command what two rounds of curl probing
  missed.** `pnpm cf:health` printed the missing-permission string verbatim, with
  the Cloudflare permission id in it. The repo's own scripts are the specification
  for what a token needs — `cf-waf-setup.mjs:634` even names the permission in its
  step label ("needs Zone Bot Management: Edit"). Read the scripts and run them;
  don't reconstruct their requirements from the outside.
- **`find . -name ".env*"` missed `.dev.vars`.** The whole "how many secret files
  are there" question was answered against a glob that could not match the file the
  user was actually asking about, and the answer "there is only one real env file"
  was given confidently while a second one sat in the repo root. Glob for the
  concept (any untracked secrets file), not for one naming convention.
- **`wrangler dev`, run only to verify which env file it loads, created a remote D1
  database as a side effect.** `wrangler.jsonc` carried
  `"database_id": "PLACEHOLDER_SET_BY_CF_SETUP"`, and the newly minted token now has
  D1 Edit — so wrangler provisioned `reely` (`3ef0e030-…`) in the account and wrote
  the real id back into the config file. Nothing was harmed and the id is what the
  placeholder wanted, but a read-only verification step mutated a remote account.
  A placeholder that a tool will "helpfully" resolve is a live wire once the
  credentials get broader.

## What worked

- Reading `getVarsForDev()` out of `node_modules/wrangler/wrangler-dist/cli.js`
  settled the precedence question in one grep, where the docs only implied it:
  `.dev.vars` is loaded first and `.env` / `.env.local` are consulted **only** when
  it is absent (`if (loadedSecrets === undefined && getCloudflareLoadDevVarsFromDotEnv())`).
  So merging the keys was not enough — leaving `.dev.vars` in place would have made
  the merged `.env.local` dead to the Worker. `getDefaultEnvFiles()` confirms
  `[".env", ".env.local"]` is the default list, so no flag or env var is needed.
- Verifying the merge by booting the real thing and reading the one line that
  proves it: `Using secrets defined in .env.local`.
- Diffing the two files by key with values never printed to the terminal, which
  also surfaced that all five shared keys were identical — the merge could not
  silently pick a stale value.

## Rules

- **A token's permission list comes from the scripts, not from probing.** Grep the
  repo for every API path and GraphQL dataset it touches, map those to permissions,
  then run each script end to end. A green `GET` is not a permission audit.
- **Account-scoped and zone-scoped analytics are two different permissions.**
  `cf-health.mjs` needs both: Account Analytics Read for
  `workersInvocationsAdaptive`, Zone Analytics Read for the eyeball 5xx query.
- **One local secrets file: `.env.local`.** Do not reintroduce `.dev.vars` — if it
  exists, wrangler ignores `.env.local` entirely and the two drift apart silently.
- **Scope tokens to the one account and the one zone, and give them an expiry.**
  "All accounts / All zones / never expires" is the default the dashboard nudges
  you toward and it is wrong for a single-site repo.
- **Treat `wrangler dev` as a mutating command when config holds placeholders.**
  It will create the resource and rewrite the config. Check `git status` after.
