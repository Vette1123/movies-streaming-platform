---
paths:
  - 'package.json'
  - 'pnpm-workspace.yaml'
  - 'pnpm-lock.yaml'
  - '.pnpmfile.cjs'
  - '.nvmrc'
  - '.github/**'
  - 'wrangler.jsonc'
---

### Toolchain, install and CI

- **Package manager is pnpm 12** (`packageManager` pin). Do not use npm/yarn. `minimumReleaseAge: 0` in `pnpm-workspace.yaml` is deliberate: the project takes every release the day it ships, and pnpm's default 1-day quarantine would hold upgrades back and fail CI's frozen install. Every dependency with an install script must be listed under `allowBuilds`, or the install errors.
- **The toolchain tracks labels, not versions**: CI runs on `ubuntu-latest`, and Node is `lts/*` from `.nvmrc`. When either is about to move, run the Deploy workflow by hand with the next runner image / Node line (`runner`, `node` inputs; untick `upload_secrets`) before the label gets there.
- **`wrangler dev` holds `out/` open on Windows**: a rebuild while it runs dies with `EBUSY: rmdir 'out'`. Stop the dev task and kill stray `workerd` processes before `pnpm build:cf`.
- **The probes that need the real player** (`pnpm hop:probe`, `pnpm resume:probe`) run against `pnpm dev` plus `pnpm harness` in `../reely-pro-player`. `pnpm share:probe` writes and deletes one throwaway user. `pnpm relay:canary` runs hourly in CI and opens a `relay-down` issue.
