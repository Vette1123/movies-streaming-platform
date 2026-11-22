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

// Bing's SubmitFeed answers 400 ThrottleUser / ThrottleHost when the same key or host resubmitted
// recently (one key covers every site, and the daily crons run together). Bing still re-reads the
// sitemap on its own schedule, so a throttle is not a failed submit.
const BING_THROTTLE = /Throttle(User|Host)/

const failure = async (res) =>
  `${res.status} ${(await res.text().catch(() => '')).slice(0, 200)}`

/**
 * Submits each feed to GSC (`gscSite`, e.g. sc-domain:reely.space) and Bing
 * (`bingSite`, the verified site URL). Returns `{ gsc, bing }`, each
 * 'ok' | 'skipped' (secret missing) | 'failed', and Bing may also be
 * 'throttled' (see BING_THROTTLE); failures print a CI warning.
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
          const why = await failure(res)
          if (BING_THROTTLE.test(why)) {
            if (result.bing === 'ok') result.bing = 'throttled'
            log(
              `seo-submit: Bing ${feed} throttled (submitted recently): ${why}`
            )
          } else {
            result.bing = 'failed'
            warn(`Bing ${feed}: ${why}`)
          }
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

// ── Daily health (pnpm seo:daily, .github/workflows/seo-daily.yml) ─────────
// Ported from portfolio-v1's bing-check, plus a Search Console sitemap read:
// the check that would have caught tv.xml sitting unread for six days.

/** A sitemap Google has not read for longer than this is a problem. */
export const SITEMAP_STALE_DAYS = 7
const DAY_MS = 86_400_000

/** Search Console's own view of the property's sitemaps. Throws on refusal. */
export async function readGscSitemaps(sa, site, fetchImpl = fetch) {
  const token = await googleAccessToken(sa, fetchImpl)
  const res = await fetchImpl(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/sitemaps`,
    { headers: { authorization: `Bearer ${token}` } }
  )
  if (!res.ok) throw new Error(`gsc sitemaps ${await failure(res)}`)
  return (await res.json()).sitemap ?? []
}

/**
 * One problem per expected feed Google does not know, has not read within
 * SITEMAP_STALE_DAYS, or reports errors in. Warnings are printed, not gated.
 * The thousands Reely had until 2026-11-22 were one per image entry: wsrv.nl's
 * robots.txt barred Googlebot from every poster (lib/tmdbConfig crawlerImage).
 * After Google re-reads the sitemaps they should sit near 0; a new climb means
 * a new cause.
 */
export function gscSitemapProblems(list, feeds, now = new Date()) {
  const byPath = new Map(list.map((s) => [s.path, s]))
  const problems = []
  for (const feed of feeds) {
    const s = byPath.get(feed)
    if (!s) {
      problems.push(`${feed}: not in Search Console`)
      continue
    }
    if (Number(s.errors) > 0) problems.push(`${feed}: ${s.errors} errors`)
    const read = s.lastDownloaded ? Date.parse(s.lastDownloaded) : NaN
    if (!(now.getTime() - read <= SITEMAP_STALE_DAYS * DAY_MS))
      problems.push(
        `${feed}: not read by Google since ${s.lastDownloaded ?? 'ever'}`
      )
  }
  return problems
}

export const BING_CALLS = [
  'GetUrlSubmissionQuota',
  'GetCrawlIssues',
  'GetCrawlStats',
]
/** Crawl-stat counters watched for a jump. */
const BING_COUNTERS = [
  'Code5xx',
  'DnsFailures',
  'ConnectionTimeout',
  'BlockedByRobotsTxt',
  'ContainsMalware',
]
/** InIndex below this share of the last week's best counts as a drop. */
export const INDEX_DROP_RATIO = 0.8
// A counter jump is a problem only when it is also more than this share of the day's crawl.
// 2026-11-21: reely.space had 48 ConnectionTimeout of 6,125 crawled (0.8%, week median 2), while the
// Worker's wall time held p99.9 3 s with 0 errors and the edge showed 0 failed crawler requests.
// A gate that is red on that every day gets ignored. A small site (26 crawled) still trips on any jump.
export const BING_JUMP_SHARE = 0.01
const WEEK = 7

/** Bing's own words for a failure ("ERROR!!! InvalidApiKey"), not just the status. */
function bingReason(text) {
  try {
    return String(JSON.parse(text)?.Message ?? text).slice(0, 200)
  } catch {
    return text.slice(0, 200)
  }
}

/** One call per BING_CALLS entry; throws with Bing's reason on the first refusal. */
export async function readBing(key, site, fetchImpl = fetch) {
  /** @type {Record<string, any>} */
  const out = {}
  for (const call of BING_CALLS) {
    const res = await fetchImpl(
      `${BING_API}/${call}?siteUrl=${encodeURIComponent(site)}&apikey=${encodeURIComponent(key)}`
    )
    const text = await res.text()
    if (!res.ok)
      throw new Error(`bing ${call} ${res.status} ${bingReason(text)}`)
    out[call] = JSON.parse(text).d
  }
  return out
}

/** Bing's "/Date(1781654400000)/" as YYYY-MM-DD. */
const bingDay = (d) =>
  new Date(Number(String(d).match(/-?\d+/)?.[0] ?? NaN))
    .toISOString()
    .slice(0, 10)

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? s[Math.floor(s.length / 2)] : 0
}

/**
 * A counter is a problem when it jumps above its own week: more than 1.5 × the
 * prior seven days' median, plus 5. Not portfolio-v1's "anything above 0":
 * Reely's Code5xx sits near 40 every day and both sites carry a robots.txt
 * block or two, so a zero baseline would fail every run and mean nothing.
 *
 * @returns {{ lines: string[], problems: string[] }}
 */
export function bingSummary({
  GetUrlSubmissionQuota: quota,
  GetCrawlIssues: issues,
  GetCrawlStats: stats,
}) {
  const lines = []
  const problems = []
  lines.push(
    `quota: ${quota?.DailyQuota} a day, ${quota?.MonthlyQuota} a month`
  )
  if (!(Number(quota?.DailyQuota) > 0))
    problems.push(`URL submission quota is ${quota?.DailyQuota} today`)

  const list = issues ?? []
  lines.push(`crawl issues: ${list.length}`)
  if (list.length)
    problems.push(
      `${list.length} crawl issues: ${list
        .slice(0, 5)
        .map((i) => `${i.Url} (${i.HttpCode})`)
        .join(', ')}`
    )

  const days = [...(stats ?? [])].sort((a, b) =>
    bingDay(a.Date).localeCompare(bingDay(b.Date))
  )
  const last = days.at(-1)
  if (!last) {
    problems.push('no crawl stats')
    return { lines, problems }
  }
  const prior = days.slice(-WEEK - 1, -1)
  lines.push(
    `crawl ${bingDay(last.Date)}: ${last.CrawledPages} crawled, ${last.InIndex} in index, ${last.CrawlErrors} errors (4xx ${last.Code4xx}, 5xx ${last.Code5xx}, timeouts ${last.ConnectionTimeout})`
  )
  for (const k of BING_COUNTERS) {
    const base = median(prior.map((d) => Number(d[k]) || 0))
    const n = Number(last[k]) || 0
    if (n <= base * 1.5 + 5) continue
    const what = `${k} ${n} on ${bingDay(last.Date)} (week median ${base})`
    if (n > (Number(last.CrawledPages) || 0) * BING_JUMP_SHARE)
      problems.push(what)
    else lines.push(`${what}, under ${BING_JUMP_SHARE * 100}% of the crawl`)
  }
  const best = Math.max(0, ...prior.map((d) => Number(d.InIndex) || 0))
  if (best > 0 && last.InIndex < best * INDEX_DROP_RATIO)
    problems.push(`in index fell to ${last.InIndex} from ${best} this week`)
  return { lines, problems }
}
