// Which 403s to a "search crawler" are a fire, and which are the site doing
// its job.
//
// The check exists because a 403 to Googlebot is a five-alarm fire: Search
// Console files it as "Blocked due to access forbidden", which is a worse
// signal than the truth. But the WAF refuses some paths on purpose — a
// scanner asking for /.env gets a 403 by design — and a scanner wearing
// Googlebot's name gets the same answer. Both are the site working exactly as
// designed, and both used to count as a fire: on 2026-10-20 the check failed
// on fourteen requests a day, every one of them a spoofed-UA /.env probe, and
// a check that is permanently red is a check nobody reads.
//
// The two rules, both of which have to hold for a 403 to count:
//
//   1. the path is not one the WAF refuses by design, and
//   2. the User-Agent is a crawler's own, not a browser wearing a crawler's
//      name.
//
// A 5xx is always a fire: the WAF answers before the origin, so a 5xx means
// the site itself failed.

/**
 * The extensions the WAF refuses, whoever asks. Mirrors the rules in
 * scripts/cf-waf-setup.mjs — the two lists have to agree, or the health check
 * grades a refusal the operator chose as an outage.
 */
const WAF_PROBE_EXTENSIONS = [
  '.php',
  '.asp',
  '.aspx',
  '.cgi',
  '.env',
  '.sql',
  '.bak',
]

/**
 * The image extensions the export does not ship, so the WAF answers them
 * with a 403 instead of a 404. A verified crawler is let through to a
 * correct 404; an unverified one gets the 403.
 */
const WAF_DEAD_IMAGE_EXTENSIONS = ['.jpg', '.jpeg']

/** True for a path the WAF refuses on purpose. */
export const isWafRefusedPath = (path) => {
  if (!path) return false
  const lower = path.toLowerCase()
  return (
    WAF_PROBE_EXTENSIONS.some((extension) => lower.endsWith(extension)) ||
    WAF_DEAD_IMAGE_EXTENSIONS.some((extension) => lower.endsWith(extension))
  )
}

/**
 * A platform token. A genuine crawler's User-Agent names none of them: the
 * real Googlebot, bingbot, Applebot and DuckDuckBot all say who they are
 * and what they crawl, and none of them pretends to be a Windows laptop.
 */
const PLATFORM = /Windows NT|Macintosh|X11|Linux|Android|iPhone|iPad|CrOS/i

/**
 * True when the User-Agent claims to be a crawler AND claims a platform —
 * which is a scraper wearing the crawler's name, not the crawler.
 */
export const isSpoofedCrawlerUserAgent = (userAgent) => {
  if (!userAgent) return false
  return PLATFORM.test(userAgent)
}

/**
 * The whole verdict for one request: does this count against the crawler
 * check?
 *
 * @param {{ userAgent?: string | null, path?: string | null, status?: number | null }} request
 */
export const isCrawlerFire = ({ userAgent, path, status }) => {
  // A 5xx is the site failing, whoever asked.
  if (typeof status === 'number' && status >= 500) return true
  if (status !== 403) return false
  if (isWafRefusedPath(path)) return false
  if (isSpoofedCrawlerUserAgent(userAgent)) return false
  return true
}
