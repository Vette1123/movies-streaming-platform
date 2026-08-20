import { itemKey } from '@/lib/library-sync'
import type { WatchedItem } from '@/hooks/use-local-storage'

/**
 * Finding one title in a library of a few thousand.
 *
 * The library grew past the point where scrolling four separate pages is a way
 * to find anything — and the one question people actually have ("is this in
 * here, and where?") could not be asked at all. This answers it across every
 * store at once, which is also what makes bulk actions possible: you cannot
 * tidy up what you cannot select.
 *
 * Entirely local. Every store is already in localStorage, the search is a
 * substring match over a few thousand short strings, and whatever is changed
 * afterwards rides out on the ordinary sync. No endpoint, no index, no server.
 */

/** The localStorage keys, in the order the results are grouped. */
export const SEARCHABLE_STORES = [
  { key: 'watchlist', label: 'Saved' },
  { key: 'watchedItems', label: 'Watched' },
  { key: 'reviews', label: 'Rated' },
  { key: 'hiddenItems', label: 'Hidden' },
] as const

export type SearchableStore = (typeof SEARCHABLE_STORES)[number]['key']

export interface LibraryHit {
  store: SearchableStore
  item: WatchedItem
  /** `store::itemKey` — unique across the whole result set, for selection. */
  id: string
}

/**
 * Lowercased and stripped of accents.
 *
 * "Amelie" has to find "Amélie", and "The Hateful Eight" has to be findable by
 * typing "hateful". Normalising both sides is the whole of it — anything
 * cleverer here (fuzzy distance, token scoring) would be a search engine built
 * for a list somebody can already almost see.
 */
export const foldText = (value: string): string =>
  value
    .normalize('NFD')
    // The Unicode combining-marks block (U+0300 to U+036F): NFD leaves the
    // accent behind as its own character, and this is what drops it.
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

/** Below this a search matches most of the library and helps nobody. */
export const MIN_QUERY = 2
/** Enough to act on. More than this and the answer is "refine the search". */
export const MAX_HITS = 60

/**
 * Every place a title appears, for one query.
 *
 * Grouped by store rather than merged, because "it is in your history AND
 * hidden" is exactly the kind of thing somebody is searching to find out.
 * Episodes collapse into their series: a show ticked off forty times is one
 * row, not forty, which is the difference between a result list and a wall.
 */
export function searchLibrary(
  stores: Partial<Record<SearchableStore, WatchedItem[]>>,
  query: string,
  limit: number = MAX_HITS
): LibraryHit[] {
  const needle = foldText(query)
  if (needle.length < MIN_QUERY) return []

  const hits: LibraryHit[] = []
  for (const { key } of SEARCHABLE_STORES) {
    const seen = new Set<string>()
    for (const item of stores[key] ?? []) {
      if (hits.length >= limit) return hits
      if (!item?.title || !foldText(item.title).includes(needle)) continue
      // The bare title, not the episode key: one row per show.
      const identity = `${item.type}:${item.id}`
      if (seen.has(identity)) continue
      seen.add(identity)
      hits.push({ store: key, item, id: `${key}::${itemKey(item)}` })
    }
  }
  return hits
}

/**
 * The rows left after removing everything selected.
 *
 * Matched on the title's identity rather than the row's own key, so removing a
 * series from "episodes ticked off" removes all of its episodes — which is what
 * somebody selecting one row for a show means by it, and what they would
 * otherwise have to do forty times.
 */
export function withoutSelected(
  rows: WatchedItem[],
  selected: WatchedItem[]
): WatchedItem[] {
  const drop = new Set(selected.map((item) => `${item.type}:${item.id}`))
  return rows.filter((row) => !drop.has(`${row.type}:${row.id}`))
}

/** The watchlist with these added, skipping anything already on it. */
export function withAdded(
  rows: WatchedItem[],
  additions: WatchedItem[]
): WatchedItem[] {
  const have = new Set(rows.map((row) => `${row.type}:${row.id}`))
  const fresh = additions.filter((item) => !have.has(`${item.type}:${item.id}`))
  // Newest first, matching how the watchlist is ordered everywhere else, and
  // with the season/episode fields dropped: a show goes on the watchlist as a
  // show, never as episode four.
  return [
    ...fresh.map(({ season, episode, ...item }) => {
      void season
      void episode
      return item
    }),
    ...rows,
  ]
}
