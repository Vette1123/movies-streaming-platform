// The pure half of scripts/seo-gsc.mjs (same module as social-media-downloader and masareef): turns Search Console rows into the two lists that
// decide the next SEO move. Kept apart so the test can feed it rows without a network.

/** @typedef {{ key: string, clicks: number, impressions: number, position: number }} GscRow */

/**
 * Rows Google ranks on page 1-2 but nobody clicks: one push (a page, a better title) from traffic.
 * @param {GscRow[]} rows
 * @param {{ minImpressions?: number, from?: number, to?: number }} [opts]
 * @returns {GscRow[]}
 */
export function strikingDistance(
  rows,
  { minImpressions = 5, from = 4, to = 20 } = {}
) {
  return rows
    .filter(
      (r) =>
        r.impressions >= minImpressions &&
        r.position >= from &&
        r.position <= to
    )
    .sort((a, b) => b.impressions - a.impressions)
}

/**
 * Rows that are seen often and never clicked: the title or description is not answering the query.
 * @param {GscRow[]} rows
 * @param {{ minImpressions?: number }} [opts]
 * @returns {GscRow[]}
 */
export function seenNotClicked(rows, { minImpressions = 20 } = {}) {
  return rows
    .filter((r) => r.clicks === 0 && r.impressions >= minImpressions)
    .sort((a, b) => b.impressions - a.impressions)
}

/**
 * Google's operator-stuffed queries (`-site:facebook.com …`) are scrapers, not people.
 * @param {string} q
 */
export const isScraper = (q) => /(^|\s)-?(site|intitle|inurl):/i.test(q)

/**
 * API rows ({keys:[x], clicks, impressions, ctr, position}) to flat rows, scrapers dropped.
 * @param {{ keys: string[], clicks: number, impressions: number, position: number }[]} [apiRows]
 * @returns {GscRow[]}
 */
export function flatten(apiRows = []) {
  return apiRows
    .map((r) => ({
      key: r.keys[0],
      clicks: r.clicks,
      impressions: r.impressions,
      position: Math.round(r.position * 10) / 10,
    }))
    .filter((r) => !isScraper(r.key))
}
