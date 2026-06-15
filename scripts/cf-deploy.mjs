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
//   4. After deploy: purge edge cache for sitemap.xml + robots.txt, then ping
//      IndexNow with the top-level URLs so Bing/Yandex/DDG pick up changes.

import { spawnSync } from 'node:child_process'
import { existsSync, renameSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

const CACHE_DIR = resolve('.open-next/cache')
const CACHE_BAK = resolve('.open-next/cache.skip-populate')
const SITE_HOST = 'www.reely.space'
const ZONE_NAME = 'reely.space'
const INDEXNOW_KEY = 'fd71a860ed122d006df9ba7c2c529b88'

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

if (deployCode === 0) {
  await postDeploy().catch((err) => {
    console.warn(`[cf-deploy] post-deploy step failed: ${err.message}`)
  })
}

process.exit(deployCode)

async function postDeploy() {
  const token = process.env.CLOUDFLARE_API_TOKEN
  if (token) {
    try {
      const zoneRes = await fetch(
        `https://api.cloudflare.com/client/v4/zones?name=${encodeURIComponent(ZONE_NAME)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      const zoneJson = await zoneRes.json()
      const zoneId = zoneJson?.result?.[0]?.id
      if (zoneId) {
        const purgeUrls = [
          `https://${SITE_HOST}/sitemap.xml`,
          `https://${SITE_HOST}/robots.txt`,
          `https://${ZONE_NAME}/sitemap.xml`,
          `https://${ZONE_NAME}/robots.txt`,
        ]
        const purgeRes = await fetch(
          `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ files: purgeUrls }),
          },
        )
        if (purgeRes.ok) console.log('✓ Purged sitemap.xml + robots.txt from CF edge')
        else console.warn(`[cf-deploy] cache purge HTTP ${purgeRes.status}`)
      }
    } catch (err) {
      console.warn(`[cf-deploy] cache purge skipped: ${err.message}`)
    }
  } else {
    console.warn('[cf-deploy] CLOUDFLARE_API_TOKEN not set — skipping cache purge')
  }

  // IndexNow: notify Bing, Yandex, Seznam (and DDG via Bing) of changed URLs.
  // We submit the top-level routes — the sitemap itself surfaces the rest.
  const urlList = [
    `https://${SITE_HOST}/`,
    `https://${SITE_HOST}/movies`,
    `https://${SITE_HOST}/tv-shows`,
    `https://${SITE_HOST}/sitemap.xml`,
  ]
  try {
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host: SITE_HOST,
        key: INDEXNOW_KEY,
        keyLocation: `https://${SITE_HOST}/${INDEXNOW_KEY}.txt`,
        urlList,
      }),
    })
    if (res.ok || res.status === 202) console.log(`✓ IndexNow pinged (${urlList.length} URLs)`)
    else console.warn(`[cf-deploy] IndexNow HTTP ${res.status}`)
  } catch (err) {
    console.warn(`[cf-deploy] IndexNow skipped: ${err.message}`)
  }
}
