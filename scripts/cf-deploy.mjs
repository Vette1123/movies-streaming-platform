#!/usr/bin/env node
// Deploy wrapper for OpenNext on Cloudflare.
//
// `opennextjs-cloudflare deploy` always runs `populate-cache` before pushing
// the worker. With the static-assets incremental cache (open-next.config.ts)
// that step is a local `cpSync` of `.open-next/cache` into
// `.open-next/assets/cdn-cgi/_next_cache`, so it is cheap, idempotent, and has
// to run BEFORE the asset upload — which is exactly the order `deploy` uses.
// We just run it. Here we:
//   1. Run deploy (populates the cache assets, then pushes the worker).
//   2. After deploy: ping IndexNow with the sitemap URLs so Bing/Yandex/DDG pick
//      up changes, and purge the CF edge cache ONLY if CF_PURGE=true (see below
//      — no deploy asks for it any more).
//
// This used to call populateCache separately and then move `.open-next/cache`
// aside so the deploy's built-in populate would find nothing and short-circuit.
// That existed for the KV store: a free-tier bulk-put can hit the write quota,
// and a failed populate kills the whole deploy, so it was worth running once
// and tolerating a partial upload. `cpSync` has no such failure mode — and on a
// missing directory it throws ENOENT instead of no-oping, which failed the
// deploy outright. Restore the dance if the incremental cache ever goes back to
// KV or R2.
//
// Why the purge is off by default: the edge-cache rule (scripts/cf-waf-setup.mjs)
// asks the CDN to hold public document pages for 8h with a TTL that is not keyed
// by build id, which is what the purge was for. But that rule never takes effect
// — on a Workers Custom Domain the Worker is the origin and runs ahead of the
// zone cache, so document routes return no cf-cache-status at all (audited
// 2026-07-30). The pages come from the incremental cache instead, which IS keyed
// by OPEN_NEXT_BUILD_ID and turns over on every deploy. Meanwhile /_next/static
// DOES get edge HITs and is content-hashed, so purging only threw away hot,
// still-valid entries. Set CF_PURGE=true to force one if that ever changes.
import { spawnSync } from 'node:child_process'

const SITE_HOST = 'www.reely.space'
const ZONE_NAME = 'reely.space'
const INDEXNOW_KEY = 'fd71a860ed122d006df9ba7c2c529b88'

function run(args) {
  // Pass a single command string (not command + args array) so `shell: true`
  // doesn't trip Node 24's DEP0190 (args-array-with-shell deprecation). `shell`
  // stays true because Windows dev needs it to resolve `pnpm` → `pnpm.cmd`; all
  // args here are internal constants, so there is no injection surface.
  const result = spawnSync(`pnpm opennextjs-cloudflare ${args.join(' ')}`, {
    stdio: 'inherit',
    shell: true,
  })
  return result.status ?? 1
}

const deployCode = run(['deploy'])

if (deployCode === 0) {
  await postDeploy().catch((err) => {
    console.warn(`[cf-deploy] post-deploy step failed: ${err.message}`)
  })
}

process.exit(deployCode)

async function postDeploy() {
  const token = process.env.CLOUDFLARE_API_TOKEN
  // Opt-IN, not opt-out: run `CF_PURGE=true pnpm deploy` to force one.
  //
  // This used to purge on every push. The purge existed to clear stale document
  // pages, but on a Workers Custom Domain the Worker IS the origin and runs
  // ahead of the zone cache, so the CDN never stored that HTML in the first
  // place (audited 2026-07-30, see scripts/cf-waf-setup.mjs) — and the pages now
  // come out of the incremental cache keyed by OPEN_NEXT_BUILD_ID, which turns
  // over on its own with each deploy. What the zone DOES cache is
  // `/_next/static/*`, which is content-hashed and never needs purging. So a
  // full purge evicted the only genuinely cached thing and cleared nothing that
  // was stale. Bring it back if Cloudflare ever starts edge-caching Worker HTML.
  const shouldPurge = process.env.CF_PURGE === 'true'
  if (token && shouldPurge) {
    try {
      const zoneRes = await fetch(
        `https://api.cloudflare.com/client/v4/zones?name=${encodeURIComponent(ZONE_NAME)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const zoneJson = await zoneRes.json()
      const zoneId = zoneJson?.result?.[0]?.id
      if (zoneId) {
        // Full purge — the only free-tier way to cover the unbounded detail
        // routes (/movies/:id, /tv-shows/:id) whose 8h edge TTL is not build-id
        // keyed. Guarantees the new deploy is served fresh everywhere.
        const purgeRes = await fetch(
          `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ purge_everything: true }),
          }
        )
        if (purgeRes.ok) console.log('✓ Purged entire CF edge cache')
        else console.warn(`[cf-deploy] cache purge HTTP ${purgeRes.status}`)
      }
    } catch (err) {
      console.warn(`[cf-deploy] cache purge skipped: ${err.message}`)
    }
  } else if (!shouldPurge) {
    console.log('• skipping edge purge (set CF_PURGE=true to force one)')
  } else {
    console.warn(
      '[cf-deploy] CLOUDFLARE_API_TOKEN not set — skipping cache purge'
    )
  }

  // IndexNow: notify Bing, Yandex, Seznam (and DDG via Bing) of changed URLs.
  //
  // Submitting only the top-level routes was not enough — Bing's SEO report
  // flagged important pages as never submitted, because "the sitemap surfaces
  // the rest" only holds once Bing chooses to re-read the sitemap. Every deploy
  // re-renders every page, so every sitemap URL is a changed URL: pull the live
  // sitemap and submit the lot. Falls back to the top-level routes if the
  // sitemap can't be read, and never fails the deploy.
  const TOP_LEVEL_URLS = [
    `https://${SITE_HOST}/`,
    `https://${SITE_HOST}/movies`,
    `https://${SITE_HOST}/tv-shows`,
    `https://${SITE_HOST}/sitemap.xml`,
  ]

  async function sitemapUrls() {
    try {
      const res = await fetch(`https://${SITE_HOST}/sitemap.xml`, {
        headers: { 'User-Agent': 'reely-deploy/1.0' },
      })
      if (!res.ok) {
        console.warn(
          `[cf-deploy] sitemap fetch HTTP ${res.status} — submitting top-level URLs only`
        )
        return TOP_LEVEL_URLS
      }
      const xml = await res.text()
      const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) =>
        m[1].trim()
      )
      // Same-host only: IndexNow rejects a payload containing any URL outside
      // the declared host, so one stray entry would drop the whole submission.
      const onHost = locs.filter((url) =>
        url.startsWith(`https://${SITE_HOST}/`)
      )
      if (!onHost.length) return TOP_LEVEL_URLS
      return [...new Set([...TOP_LEVEL_URLS, ...onHost])]
    } catch (err) {
      console.warn(
        `[cf-deploy] sitemap fetch failed (${err.message}) — submitting top-level URLs only`
      )
      return TOP_LEVEL_URLS
    }
  }

  const urlList = await sitemapUrls()
  // IndexNow caps a submission at 10,000 URLs.
  const BATCH_SIZE = 10000
  let submitted = 0
  for (let i = 0; i < urlList.length; i += BATCH_SIZE) {
    const batch = urlList.slice(i, i + BATCH_SIZE)
    try {
      const res = await fetch('https://api.indexnow.org/indexnow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: SITE_HOST,
          key: INDEXNOW_KEY,
          keyLocation: `https://${SITE_HOST}/${INDEXNOW_KEY}.txt`,
          urlList: batch,
        }),
      })
      if (res.ok || res.status === 202) submitted += batch.length
      else
        console.warn(
          `[cf-deploy] IndexNow HTTP ${res.status} for ${batch.length} URLs`
        )
    } catch (err) {
      console.warn(`[cf-deploy] IndexNow batch skipped: ${err.message}`)
    }
  }
  if (submitted)
    console.log(`✓ IndexNow pinged (${submitted}/${urlList.length} URLs)`)
}
