#!/usr/bin/env node
// Deploy wrapper for the static export + Worker.
//
// The build (`pnpm build:cf`) has already written the site to `out/` and the
// bundled Worker to `.cloudflare/worker.mjs`. This just pushes both with
// `wrangler deploy` and then:
//   1. Pings IndexNow with the sitemap URLs so Bing/Yandex/DDG pick up changes.
//   2. Purges the CF edge cache ONLY if CF_PURGE=true (see below).
//
// It used to drive `opennextjs-cloudflare deploy`, whose populate-cache step
// copied a prerender cache into the asset directory. There is no incremental
// cache any more — every prerendered page IS a static asset, and the only
// runtime cache is `caches.default` inside the Worker.
//
// Why the purge is off by default: /_next/static is content-hashed, so purging
// only throws away hot, still-valid entries. Documents are served straight from
// the asset store, which is replaced wholesale by the deploy. Set CF_PURGE=true
// to force one if that ever changes.
import { spawnSync } from 'node:child_process'

const SITE_HOST = 'www.reely.space'
const ZONE_NAME = 'reely.space'
const INDEXNOW_KEY = 'fd71a860ed122d006df9ba7c2c529b88'

function run(args) {
  // Pass a single command string (not command + args array) so `shell: true`
  // doesn't trip Node 24's DEP0190 (args-array-with-shell deprecation). `shell`
  // stays true because Windows dev needs it to resolve `pnpm` → `pnpm.cmd`; all
  // args here are internal constants, so there is no injection surface.
  const result = spawnSync(`pnpm wrangler ${args.join(' ')}`, {
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
  // are static assets replaced wholesale by the deploy, while the Worker's own
  // `caches.default` is keyed by the Next build id (see scripts/build-worker.mjs)
  // so it turns over on its own too. What the zone DOES cache is
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
