#!/usr/bin/env node
// Deploy wrapper for the static export + Worker.
//
// The build (`pnpm build:cf`) has already written the site to `out/` and the
// bundled Worker to `.cloudflare/worker.mjs`. This just pushes both with
// `wrangler deploy` and then:
//   1. Pings IndexNow with the URLs this build CHANGED (new to the sitemap, or
//      a prerendered page whose indexed content differs), not every sitemap URL.
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

import { countFiles } from './lib/asset-budget.mjs'
import { planIndexNow, submitIndexNow } from './lib/indexnow.mjs'

// See scripts/load-env.mjs: AAAA-first resolution turns the purge into a
// `fetch failed` on any machine without a working IPv6 route, and a failed
// purge pins the site to the previous build.
setDefaultResultOrder('ipv4first')

const SITE_HOST = 'www.reely.space'
const ZONE_NAME = 'reely.space'

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

// ---- asset-cap guard (runs before anything is uploaded) --------------------
// Workers Static Assets refuses a project over 20,000 files. The export's
// per-route cost is 6 files — `<id>.html`, `<id>.txt`, and four segment-cache
// files the client fetches on hover prefetch and navigation (measured and
// sourced in lib/media-page.ts) — so the cap is a ROUTE budget. Counting out/
// here turns an over-cap build into a loud red deploy with the remedy
// attached, instead of a Cloudflare upload error after CI already went green.
const GUARD_FILES = 19200

const outFiles = countFiles(new URL('../out', import.meta.url))
if (outFiles > GUARD_FILES) {
  console.error(
    `::error::[cf-deploy] out/ holds ${outFiles} files — past the ${GUARD_FILES} guard (Static Assets caps a project at 20,000; going over fails the upload AFTER a green build). Trim routes: lower listDepth.popular in config/catalogue.json (each page ≈ 20 titles × 6 files, movies and tv), then rebuild.`
  )
  process.exit(1)
}
console.log(
  `[cf-deploy] asset budget: ${outFiles} / 20,000 files in out/ (guard ${GUARD_FILES})`
)

// The diff against the live site has to be taken BEFORE the deploy: afterwards
// "live" is this build. Never fails the deploy; null means "submit everything".
const indexNowPlan = await planIndexNow().catch((err) => {
  console.warn(`[cf-deploy] IndexNow diff failed: ${err.message}`)
  return { urls: [], changed: null, why: err.message }
})

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

  // IndexNow: notify Bing, Yandex, Seznam (and DDG via Bing) of CHANGED URLs.
  //
  // The set was computed before the deploy (scripts/lib/indexnow.mjs): URLs new
  // to the live sitemap, plus prerendered pages whose title, meta, JSON-LD or
  // visible text differ from what was live. Pinging all ~14,800 on every deploy
  // told Bing nothing and trained it to ignore the pings. If the diff could not
  // be taken, fall back to every sitemap URL (or the top-level routes) and say so.
  const TOP_LEVEL_URLS = [
    `https://${SITE_HOST}/`,
    `https://${SITE_HOST}/movies`,
    `https://${SITE_HOST}/tv-shows`,
    `https://${SITE_HOST}/sitemap.xml`,
  ]
  let urlList
  if (indexNowPlan.changed === null) {
    urlList = indexNowPlan.urls.length ? indexNowPlan.urls : TOP_LEVEL_URLS
    console.warn(
      `[cf-deploy] IndexNow diff unavailable (${indexNowPlan.why}), sending ${urlList.length} URLs`
    )
  } else {
    urlList = indexNowPlan.urls.filter((u) => indexNowPlan.changed.has(u))
    console.log(
      `• IndexNow: ${urlList.length} of ${indexNowPlan.urls.length} URLs changed`
    )
  }
  const submitted = urlList.length ? await submitIndexNow(urlList) : 0
  if (submitted)
    console.log(`✓ IndexNow pinged (${submitted}/${urlList.length} URLs)`)

  await annotateDeploy()
}

/**
 * A deploy marker on every PostHog chart, so "plays dropped on Tuesday" can be
 * lined up with what shipped on Tuesday. Never fails the deploy: a key without
 * the annotation scope only warns.
 */
async function annotateDeploy() {
  const key = process.env.POSTHOG_API_KEY
  if (!key) {
    console.log(
      '• skipping PostHog deploy annotation (POSTHOG_API_KEY not set)'
    )
    return
  }
  const project = process.env.POSTHOG_PROJECT_ID || '216915'
  const host = process.env.POSTHOG_HOST || 'https://eu.posthog.com'
  const sha = (process.env.GITHUB_SHA || 'local').slice(0, 7)
  try {
    const res = await fetch(`${host}/api/projects/${project}/annotations/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: `Deploy ${sha}`,
        date_marker: new Date().toISOString(),
        scope: 'project',
      }),
    })
    if (res.ok) console.log(`✓ PostHog deploy annotation (${sha})`)
    else
      console.warn(
        `::warning::[cf-deploy] PostHog annotation HTTP ${res.status} — does POSTHOG_API_KEY carry annotation:write?`
      )
  } catch (err) {
    console.warn(`[cf-deploy] PostHog annotation skipped: ${err.message}`)
  }
}
