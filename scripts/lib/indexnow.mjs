// Decides which URLs a deploy actually changed, so IndexNow is told about
// those and nothing else. Bing asks for changed URLs only; pinging all ~14,800
// sitemap URLs on every deploy trains it to ignore the pings.
//
// Reely is a static export on Cloudflare: the new build is in `out/` BEFORE
// `wrangler deploy` runs, and the previous deploy still serves until it does.
// So the diff has to be computed before the deploy (see scripts/cf-deploy.mjs).
//
// A page's fingerprint is what a search engine indexes: title, meta tags,
// canonical, JSON-LD and visible text. Script/style tags are dropped, so the
// per-build chunk hashes and the RSC payload Next writes into every page do not
// count.
import { promises as fs } from 'node:fs'
import path from 'node:path'

export const SITE_HOST = 'www.reely.space'
export const BASE_URL = `https://${SITE_HOST}`
export const INDEXNOW_KEY = 'fd71a860ed122d006df9ba7c2c529b88'
// Live-page fetches in flight at once. ~1,000 prerendered pages are compared;
// 6 keeps that polite to our own edge and finishes in well under a minute.
export const LIVE_FETCH_CONCURRENCY = 6

const LD_JSON =
  /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g
const TITLE = /<title[^>]*>([\s\S]*?)<\/title>/
const META = /<meta\s[^>]*>/g
const NOINDEX = /<meta\s[^>]*name="robots"[^>]*content="[^"]*noindex/i
const CANONICAL = /<link\s[^>]*rel="canonical"[^>]*>/g

export function pageFingerprint(html) {
  const title = html.match(TITLE)?.[1]?.trim() ?? ''
  // The Worker serves the same tags serialised differently from the static
  // file (`/>` vs `>`, another order, repeats), so compare them as a sorted set.
  const tags = (list) =>
    [...new Set(list.map((t) => t.replace(/\s*\/?>$/, '>')))].sort()
  const metas = tags(
    (html.match(META) ?? []).filter(
      (tag) => !/charSet|name="viewport"|name="next-size-adjust"/i.test(tag)
    )
  )
  const canonical = tags(html.match(CANONICAL) ?? [])
  const ldJson = [...html.matchAll(LD_JSON)].map((m) => m[1].trim())
  const body = (html.split(/<body[^>]*>/)[1] ?? html)
    .replace(/<(script|style|noscript|template)[^>]*>[\s\S]*?<\/\1>/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return [title, ...metas, ...canonical, ...ldJson, body].join('\n')
}

/** `<loc>` values of a sitemap body. */
export function sitemapUrls(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim())
}

/**
 * One verdict per URL: 'new' | 'changed' | 'live-unreadable' | null (skip).
 * `built` is null for pages this build does not prerender (the movie/TV detail
 * routes beyond the baked set): their HTML is produced at request time, so from
 * a deploy's point of view they change only by being new to the sitemap.
 */
export function changeReason({ url, liveSitemap, built, live }) {
  // A page that tells engines to leave (the 404 shell a failed TMDB read bakes)
  // is never worth a ping, new or not.
  if (built !== null && NOINDEX.test(built)) return null
  if (!liveSitemap.has(url)) return 'new'
  if (built === null) return null
  if (live === null) return 'live-unreadable'
  return pageFingerprint(built) === pageFingerprint(live) ? null : 'changed'
}

/** The static-export file for a page URL: `/` → `index.html`, `/a/b` → `a/b.html`. */
export function htmlRouteFor(url, baseUrl = BASE_URL) {
  if (!url.startsWith(baseUrl)) return null
  const rest = url.slice(baseUrl.length).replace(/^\/|\/$/g, '')
  return `${rest || 'index'}.html`
}

/** Run `fn` over `items` with at most `limit` in flight. */
export async function mapLimit(items, limit, fn) {
  const out = new Array(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}

// The WAF 403s any UA that is not a browser or a verified crawler (curl, a
// bare "bot" string), so read our own pages the way a browser does.
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'

async function fetchText(url) {
  // The WAF rate-limits bursts (429/403) and the edge sometimes 5xxs; a page
  // that fails once is retried with a growing pause before it counts as
  // unreadable, so a throttled run does not submit a thousand pages unchanged.
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': BROWSER_UA } })
      if (res.ok) return await res.text()
      if (res.status === 404) return null
    } catch {
      // network blip: retry
    }
    await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)))
  }
  return null
}

async function diffAgainstLive(urls, liveSitemap, outDir) {
  const changed = new Map()
  await mapLimit(urls, LIVE_FETCH_CONCURRENCY, async (url) => {
    const route = htmlRouteFor(url)
    let built = null
    if (route) {
      built = await fs.readFile(path.join(outDir, route), 'utf8').catch(() => null)
    }
    const live = built !== null ? await fetchText(url) : null
    const reason = changeReason({ url, liveSitemap, built, live })
    if (reason) changed.set(url, reason)
  })
  return changed
}

/**
 * The URLs this build changed vs the live site, each with its reason. The new
 * URL set is `out/sitemap.xml` (the static export bakes it); the live set is the
 * sitemap the previous deploy serves right now. `changed` is null when either
 * cannot be read: the caller submits everything and says so.
 */
export async function planIndexNow({ outDir = path.join(process.cwd(), 'out') } = {}) {
  const [newXml, liveXml] = await Promise.all([
    fs.readFile(path.join(outDir, 'sitemap.xml'), 'utf8').catch(() => null),
    fetchText(`${BASE_URL}/sitemap.xml`),
  ])
  if (newXml === null) return { urls: [], changed: null, why: 'out/sitemap.xml missing' }
  const urls = [...new Set(sitemapUrls(newXml))].filter((u) =>
    u.startsWith(`${BASE_URL}`)
  )
  if (liveXml === null) return { urls, changed: null, why: 'live sitemap unreadable' }
  const changed = await diffAgainstLive(urls, new Set(sitemapUrls(liveXml)), outDir)
  return { urls, changed }
}

/** POST the URLs to IndexNow in batches of 10,000 (its cap). Returns the count accepted. */
export async function submitIndexNow(urlList) {
  let submitted = 0
  for (let i = 0; i < urlList.length; i += 10000) {
    const batch = urlList.slice(i, i + 10000)
    try {
      const res = await fetch('https://api.indexnow.org/indexnow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: SITE_HOST,
          key: INDEXNOW_KEY,
          keyLocation: `${BASE_URL}/${INDEXNOW_KEY}.txt`,
          urlList: batch,
        }),
      })
      if (res.ok || res.status === 202) submitted += batch.length
      else console.warn(`[indexnow] HTTP ${res.status} for ${batch.length} URLs`)
    } catch (err) {
      console.warn(`[indexnow] batch skipped: ${err.message}`)
    }
  }
  return submitted
}
