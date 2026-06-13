#!/usr/bin/env node
// Deploy wrapper for OpenNext on Cloudflare.
//
// `opennextjs-cloudflare deploy` always runs `populate-cache` before pushing
// the worker. On the free tier the KV bulk-put quota is easy to hit, and a
// failed populate kills the whole deploy. Here we:
//   1. Try populate-cache once and tolerate failure (partial uploads are fine
//      — KV writes are idempotent).
//   2. Move `.open-next/cache` aside so the deploy step's built-in populate
//      finds no assets and short-circuits.
//   3. Run deploy. The worker ships even when KV is rate-limited.

import { spawnSync } from 'node:child_process'
import { existsSync, renameSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

const CACHE_DIR = resolve('.open-next/cache')
const CACHE_BAK = resolve('.open-next/cache.skip-populate')

function run(args) {
  const result = spawnSync('pnpm', ['opennextjs-cloudflare', ...args], {
    stdio: 'inherit',
    shell: true,
  })
  return result.status ?? 1
}

const popCode = run(['populateCache', 'remote'])
if (popCode !== 0) {
  console.warn(
    `\n[cf-deploy] populateCache exited ${popCode} — continuing with worker deploy (cache may be stale).\n`,
  )
}

let moved = false
if (existsSync(CACHE_DIR)) {
  if (existsSync(CACHE_BAK)) rmSync(CACHE_BAK, { recursive: true, force: true })
  renameSync(CACHE_DIR, CACHE_BAK)
  moved = true
}

const deployCode = run(['deploy'])

if (moved && existsSync(CACHE_BAK)) {
  if (existsSync(CACHE_DIR)) rmSync(CACHE_DIR, { recursive: true, force: true })
  renameSync(CACHE_BAK, CACHE_DIR)
}

process.exit(deployCode)
