// Pure half of `pnpm seo:pending`: which sitemap URLs to inspect today, which inspected ones
// are worth a Request Indexing, and the ledger that stops either repeating. Same file in Reely
// and social-media-downloader; the IO half is scripts/seo-pending.mjs.

/** A URL logged as requested is not offered again for this many days. */
export const REQUEST_COOLDOWN_DAYS = 14
/** An indexed URL is not inspected again for this many days. */
export const INDEXED_RECHECK_DAYS = 30
/** A not-indexed URL is re-inspected after this many days (Google may have got to it). */
export const PENDING_RECHECK_DAYS = 3
/** Request Indexing picks per day: Search Console's own daily allowance is about 10. */
export const DAILY_PICKS = 10

/**
 * Coverage states a Request Indexing can move. Everything else is a decision Google made from
 * the page itself (a redirect, a canonical elsewhere, noindex, a 404), and requesting it again
 * changes nothing.
 */
const REQUESTABLE = [
  /discovered.*not indexed/i,
  /crawled.*not indexed/i,
  /unknown to google/i,
]

const DAY_MS = 86_400_000

/** Whole days from `from` to `to`, both YYYY-MM-DD. */
export function daysBetween(from, to) {
  return Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS)
}

/**
 * @typedef {{ date: string, indexed: boolean, state: string }} Inspection
 * @typedef {{ requested: Record<string, string>, inspected: Record<string, Inspection> }} Ledger
 * @returns {Ledger}
 */
export function emptyLedger() {
  return { requested: {}, inspected: {} }
}

/** Whether an inspection result is still fresh enough to skip spending quota on. */
function inspectedRecently(entry, today) {
  if (!entry) return false
  const age = daysBetween(entry.date, today)
  return age < (entry.indexed ? INDEXED_RECHECK_DAYS : PENDING_RECHECK_DAYS)
}

function requestedRecently(ledger, url, today) {
  const date = ledger.requested[url]
  return !!date && daysBetween(date, today) < REQUEST_COOLDOWN_DAYS
}

/** The next `limit` URLs to inspect, in sitemap order (the priority order). */
export function toInspect(urls, ledger, today, limit) {
  const out = []
  for (const url of urls) {
    if (out.length >= limit) break
    if (requestedRecently(ledger, url, today)) continue
    if (inspectedRecently(ledger.inspected[url], today)) continue
    out.push(url)
  }
  return out
}

/** One URL Inspection API answer, reduced to what the ledger keeps. */
export function readInspection(json) {
  const status = json?.inspectionResult?.indexStatusResult ?? {}
  return {
    indexed: status.verdict === 'PASS',
    state: status.coverageState ?? 'unknown',
  }
}

export function isRequestable(state) {
  return REQUESTABLE.some((pattern) => pattern.test(state))
}

/** Every known not-indexed URL, with its state, in sitemap order. */
export function notIndexed(urls, ledger) {
  return urls
    .filter((url) => ledger.inspected[url] && !ledger.inspected[url].indexed)
    .map((url) => ({ url, state: ledger.inspected[url].state }))
}

/** Today's picks: requestable, not requested in the cooldown, at most DAILY_PICKS. */
export function picks(urls, ledger, today) {
  return notIndexed(urls, ledger)
    .filter(({ state }) => isRequestable(state))
    .filter(({ url }) => !requestedRecently(ledger, url, today))
    .slice(0, DAILY_PICKS)
}

/**
 * Sitemap URLs in the order worth spending a request on: shallow pages first (home, sections),
 * then paths under a `preferred` prefix (Reely's title pages), then the rest, each group keeping
 * sitemap order. Alphabetical sitemap order alone put 156 collection pages ahead of every title.
 */
export function rankUrls(urls, preferred = []) {
  const score = (url) => {
    const path = new URL(url).pathname.replace(/\/+$/, '')
    const depth = path.split('/').filter(Boolean).length
    if (depth <= 1) return 0
    return preferred.some((p) => path.startsWith(p)) ? 1 : 2
  }
  return urls
    .map((url, i) => ({ url, i, s: score(url) }))
    .sort((a, b) => a.s - b.s || a.i - b.i)
    .map((r) => r.url)
}
