// Tells Google Search Console and Bing Webmaster Tools to re-read our sitemaps.
// Ported from portfolio-v1 lib/search-engines.mjs. IndexNow covers Bing's page
// pings; this is the sitemap half, which Google has no IndexNow for.
//
// Runs after a deploy that changed URLs (scripts/cf-deploy.mjs) and by hand as
// `pnpm seo:submit`. Every child of a sitemap index is submitted too: on
// 2026-11-21 Google had never read tv.xml, six days after the index named it.
//
// Never throws: a search-engine API must not fail a deploy. Secrets:
// GSC_SERVICE_ACCOUNT_JSON (a service account with Full access to the GSC
// property) and BING_API_KEY. Either missing skips that engine with a notice.

export const GSC_SCOPE = 'https://www.googleapis.com/auth/webmasters'
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const BING_API = 'https://ssl.bing.com/webmaster/api.svc/json'

const b64url = (bytes) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
const b64urlJson = (obj) =>
  b64url(new TextEncoder().encode(JSON.stringify(obj)))

/** A signed service-account assertion for Google's token endpoint, valid one hour. */
export async function googleJwt(sa, nowSec) {
  const der = Uint8Array.from(
    atob(sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')),
    (c) => c.charCodeAt(0)
  )
  const key = await crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const unsigned = `${b64urlJson({ alg: 'RS256', typ: 'JWT' })}.${b64urlJson({
    iss: sa.client_email,
    scope: GSC_SCOPE,
    aud: GOOGLE_TOKEN_URL,
    iat: nowSec,
    exp: nowSec + 3600,
  })}`
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsigned)
  )
  return `${unsigned}.${b64url(sig)}`
}

/** Trades the assertion for an access token. Throws with the status on failure. */
export async function googleAccessToken(
  sa,
  fetchImpl = fetch,
  nowSec = Math.floor(Date.now() / 1000)
) {
  const res = await fetchImpl(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${await googleJwt(sa, nowSec)}`,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || !json.access_token)
    throw new Error(`google token ${res.status} ${json.error ?? ''}`.trim())
  return json.access_token
}

/** The sitemap itself, then every child it lists when it is a <sitemapindex>. */
export function sitemapFeeds(rootUrl, rootXml) {
  if (!/<sitemapindex[\s>]/.test(rootXml ?? '')) return [rootUrl]
  const children = [...rootXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) =>
    m[1].trim()
  )
  return [rootUrl, ...children]
}

const failure = async (res) =>
  `${res.status} ${(await res.text().catch(() => '')).slice(0, 200)}`

/**
 * Submits each feed to GSC (`gscSite`, e.g. sc-domain:reely.space) and Bing
 * (`bingSite`, the verified site URL). Returns `{ gsc, bing }`, each
 * 'ok' | 'skipped' (secret missing) | 'failed'; failures print a CI warning.
 *
 * @param {{ feeds: string[], gscSite: string, bingSite: string }} target
 * @param {Record<string, string | undefined>} [env]
 * @param {(url: string, init?: RequestInit) => Promise<Response>} [fetchImpl]
 * @param {(line: string) => void} [log]
 */
export async function submitSitemaps(
  { feeds, gscSite, bingSite },
  env = process.env,
  fetchImpl = fetch,
  log = console.log
) {
  const warn = (msg) => log(`::warning::seo-submit: ${msg}`)
  const result = { gsc: 'skipped', bing: 'skipped' }

  if (env.GSC_SERVICE_ACCOUNT_JSON) {
    try {
      const token = await googleAccessToken(
        JSON.parse(env.GSC_SERVICE_ACCOUNT_JSON),
        fetchImpl
      )
      result.gsc = 'ok'
      for (const feed of feeds) {
        const res = await fetchImpl(
          `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(gscSite)}/sitemaps/${encodeURIComponent(feed)}`,
          { method: 'PUT', headers: { authorization: `Bearer ${token}` } }
        )
        log(`seo-submit: Search Console ${feed} -> ${res.status}`)
        if (!res.ok) {
          result.gsc = 'failed'
          warn(`Search Console ${feed}: ${await failure(res)}`)
        }
      }
    } catch (e) {
      result.gsc = 'failed'
      warn(`Search Console: ${e instanceof Error ? e.message : e}`)
    }
  } else {
    log('seo-submit: GSC_SERVICE_ACCOUNT_JSON not set, Search Console skipped')
  }

  if (env.BING_API_KEY) {
    result.bing = 'ok'
    for (const feed of feeds) {
      try {
        const res = await fetchImpl(
          `${BING_API}/SubmitFeed?apikey=${env.BING_API_KEY}`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json; charset=utf-8' },
            body: JSON.stringify({ siteUrl: bingSite, feedUrl: feed }),
          }
        )
        log(`seo-submit: Bing ${feed} -> ${res.status}`)
        if (!res.ok) {
          result.bing = 'failed'
          warn(`Bing ${feed}: ${await failure(res)}`)
        }
      } catch (e) {
        result.bing = 'failed'
        warn(`Bing ${feed}: ${e instanceof Error ? e.message : e}`)
      }
    }
  } else {
    log('seo-submit: BING_API_KEY not set, Bing Webmaster skipped')
  }
  return result
}
