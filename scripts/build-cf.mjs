#!/usr/bin/env node
// The production build: static export + bundled Worker.
//
// `DEPLOY_TARGET=cloudflare` is what flips next.config.mjs into
// `output: 'export'`. Setting it here rather than inline in the npm script
// keeps the command identical on Windows and Linux without pulling in
// cross-env for one variable.
import { spawnSync } from 'node:child_process'

function run(command, extraEnv = {}) {
  // A single command string (not command + args array) so `shell: true` doesn't
  // trip Node 24's DEP0190. `shell` stays true because Windows needs it to
  // resolve `pnpm` → `pnpm.cmd`; every argument here is an internal constant.
  const result = spawnSync(command, {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, ...extraEnv },
  })
  return result.status ?? 1
}

const buildCode = run('pnpm next build', { DEPLOY_TARGET: 'cloudflare' })
if (buildCode !== 0) process.exit(buildCode)

process.exit(run('node scripts/build-worker.mjs'))
