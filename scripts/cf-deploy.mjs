#!/usr/bin/env node
// Deploy wrapper for the static export + Worker.
//
// The build (`pnpm build:cf`) has already written the site to `out/` and the
// bundled Worker to `.cloudflare/worker.mjs`. This just pushes both with
// `wrangler deploy` and then:
//   1. Pings IndexNow with the sitemap URLs so Bing/Yandex/DDG pick up changes.
//   2. Purges the CF edge cache, unless CF_PURGE=false (see below).
//
// It used to drive `opennextjs-cloudflare deploy`, whose populate-cache step
// copied a prerender cache into the asset directory. There is no incremental
// cache any more — every prerendered page IS a static asset, and the only
// runtime cache is `caches.default` inside the Worker.
//
// Why the purge is back ON by default: it was disabled on the premise that the
// zone never stored our HTML, which was true only while the Worker was the
// origin for every document (OpenNext). Since the static-export migration the
// document routes are plain assets, and Cloudflare DOES cache those — measured
// 2026-08-06, `CF-Cache-Status: HIT` on `/`, at the time an 8h edge TTL with a
// 24h `stale-while-revalidate` behind it. A colo could therefore keep serving the
// PREVIOUS deploy's homepage for up to 32h after this one landed, which silently
// capped freshness far below the deploy cadence. The purge costs
// only a refill of content-hashed `/_next/static` entries — asset reads, no
// Worker invocation, no TMDB call — so it is cheap relative to shipping a build
// nobody sees. Set CF_PURGE=false to skip it (e.g. a config-only redeploy).
import { spawnSync } from 'node:child_process'
import { setDefaultResultOrder } from 'node:dns'

// See scripts/load-env.mjs: AAAA-first resolution turns the purge into a
// `fetch failed` on any machine without a working IPv6 route, and a failed
// purge pins the site to the previous build.
setDefaultResultOrder('ipv4first')

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
  // Opt-OUT: run `CF_PURGE=false pnpm deploy` to skip it.
  //
  // The 2026-07-30 audit that turned this off measured the Worker-origin era,
  // where CF stored no document HTML at all. That is no longer the shape of the
  // site: `/`, `/movies`, `/tv-shows` and every prerendered detail page are
  // static assets now, they carry an 8h `s-maxage` plus a 24h
  // `stale-while-revalidate`, and the zone caches them for real (`CF-Cache-Status:
  // HIT`). Nothing else evicts them — the asset store is replaced wholesale by
  // the deploy, but a colo holding a cached copy never learns that. Only the
  // Worker's own `caches.default` self-invalidates, because it is keyed by the
  // Next build id (see scripts/build-worker.mjs); the zone cache has no such key.
  // So without this purge the deploy cadence set an upper bound on freshness that
  // the edge TTL then quietly ignored.
  const shouldPurge = process.env.CF_PURGE !== 'false'
  // The purge is now what makes a deploy visible, so a failed one is a real
  // regression wearing a warning's clothes — it leaves the edge serving the old
  // build for up to 32h with a green deploy. `::error::` gets it annotated on the
  // run instead of buried in the log. Deliberately NOT fatal: the Worker and the
  // assets are already live at this point, and failing the job here would only
  // trade a stale edge for a red deploy that fixes nothing. Most likely cause is
  // a token missing `Zone · Cache Purge · Purge`.
  const purgeFailed = (why) =>
    console.error(`::error::[cf-deploy] edge cache NOT purged — ${why}`)
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
        else purgeFailed(`purge_cache returned HTTP ${purgeRes.status}`)
      } else {
        purgeFailed(`could not resolve a zone id for ${ZONE_NAME}`)
      }
    } catch (err) {
      purgeFailed(err.message)
    }
  } else if (!shouldPurge) {
    console.log('• skipping edge purge (CF_PURGE=false)')
  } else {
    purgeFailed('CLOUDFLARE_API_TOKEN not set')
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
