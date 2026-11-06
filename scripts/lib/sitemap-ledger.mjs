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

/** The ledger with every detail id in `urls` added. Sorted, so diffs stay small. */
export function mergeLedger(ledger, urls) {
  const found = detailIds(urls)
  const merged = {}
  for (const key of ['movie', 'tv']) {
    const all = new Set([...(ledger?.[key] ?? []), ...found[key]])
    merged[key] = [...all].sort((a, b) => a - b)
  }
  return merged
}
