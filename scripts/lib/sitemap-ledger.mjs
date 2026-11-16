// Every movie/series id the sitemap has ever advertised, so it never stops.
//
// The sitemap is built from TMDB lists that move: today's trending, and the
// similar/recommended rails of whatever is popular this week. Each deploy
// dropped hundreds of title URLs it had advertised six hours earlier (the
// total swung 14,890 → 15,557 between consecutive deploys). A crawler fetched
// them while they were listed, kept them, and Bing then reported them as
// "important pages missing in sitemaps" (/tv-shows/321231, /movies/1229031,
// /tv-shows/330613 on 2026-11-06). Same trap data/people.json fixes for people:
// never advertise a set taken from a list that moves. Union, never replace.

/** Sitemap path segment → ledger key. */
const SECTIONS = { movies: 'movie', 'tv-shows': 'tv' }

const DETAIL = /^https?:\/\/[^/]+\/(movies|tv-shows)\/(\d+)$/

/** `{ movie: number[], tv: number[] }` — the ids of the detail URLs in `urls`. */
export function detailIds(urls) {
  const ids = { movie: new Set(), tv: new Set() }
  for (const url of urls) {
    const match = DETAIL.exec(url)
    if (match) ids[SECTIONS[match[1]]].add(Number(match[2]))
  }
  return ids
}

// The one exception to "never drop": a title TMDB itself has deleted. Its page
// answers 404, so advertising it only feeds GSC's "Not found (404)" bucket
// (/movies/1821659, 2026-11-16). Such ids move to `gone` and are never re-added,
// even while a sitemap built before the probe still lists them.

/**
 * @typedef {{ movie: number[], tv: number[] }} Ids
 * @typedef {Ids & { gone: Ids, probe: { movie: number, tv: number } }} Ledger
 */

const KEYS = /** @type {const} */ (['movie', 'tv'])

const goneSet = (ledger, key) => new Set(ledger?.gone?.[key] ?? [])

/**
 * The ledger with every detail id in `urls` added, minus gone ids. Sorted, so diffs stay small.
 * @returns {Ledger}
 */
export function mergeLedger(ledger, urls) {
  const found = detailIds(urls)
  const merged = { movie: [], tv: [] }
  const gone = { movie: [], tv: [] }
  for (const key of KEYS) {
    const dead = goneSet(ledger, key)
    const all = new Set([...(ledger?.[key] ?? []), ...found[key]])
    merged[key] = [...all].filter((id) => !dead.has(id)).sort((a, b) => a - b)
    gone[key] = [...dead].sort((a, b) => a - b)
  }
  return { ...merged, gone, probe: ledger?.probe ?? { movie: 0, tv: 0 } }
}

/**
 * `ids` of `key` moved from the live list into `gone`.
 * @returns {Ledger}
 */
export function markGone(ledger, key, ids) {
  const dead = new Set([...goneSet(ledger, key), ...ids])
  const gone = { movie: [], tv: [] }
  for (const k of KEYS)
    gone[k] =
      k === key ? [...dead].sort((a, b) => a - b) : (ledger?.gone?.[k] ?? [])
  return {
    ...ledger,
    [key]: (ledger[key] ?? []).filter((id) => !dead.has(id)),
    gone,
  }
}

/** Up to `n` ids starting at index `cursor`, wrapping, never repeating one. */
export function nextProbe(ids, cursor, n) {
  if (!ids.length) return []
  const count = Math.min(n, ids.length)
  return Array.from({ length: count }, (_, i) => ids[(cursor + i) % ids.length])
}
