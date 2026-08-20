import { describe, expect, it } from 'vitest'

import {
  foldText,
  MIN_QUERY,
  searchLibrary,
  withAdded,
  withoutSelected,
} from '@/lib/library-search'
import type { WatchedItem } from '@/hooks/use-local-storage'

const title = (
  id: number,
  name: string,
  over: Partial<WatchedItem> = {}
): WatchedItem => ({
  id,
  type: 'movie',
  title: name,
  overview: '',
  backdrop_path: '',
  poster_path: '',
  added_at: '2026-01-01T00:00:00.000Z',
  modified_at: '2026-01-01T00:00:00.000Z',
  ...over,
})

const AMELIE = title(194, 'Amélie')
const HEAT = title(949, 'Heat')
const GOT = title(1399, 'Game of Thrones', { type: 'series' })

describe('foldText', () => {
  it('strips accents so an unaccented query still finds the title', () => {
    expect(foldText('Amélie')).toBe('amelie')
    expect(foldText('  THE Hateful Eight ')).toBe('the hateful eight')
  })
})

describe('searchLibrary', () => {
  const stores = {
    watchlist: [AMELIE, HEAT],
    watchedItems: [HEAT],
    hiddenItems: [GOT],
  }

  it('says every place a title is, not just the first', () => {
    // "It is in your history AND hidden" is exactly what somebody is searching
    // to find out, so the stores are reported separately rather than merged.
    const hits = searchLibrary(stores, 'heat')
    expect(hits.map((hit) => hit.store)).toEqual(['watchlist', 'watchedItems'])
  })

  it('matches on a substring, unaccented', () => {
    expect(searchLibrary(stores, 'amelie')).toHaveLength(1)
    expect(searchLibrary(stores, 'thrones')[0].item.id).toBe(1399)
  })

  it('refuses to answer a query too short to mean anything', () => {
    expect(searchLibrary(stores, 'h')).toEqual([])
    expect('h'.length).toBeLessThan(MIN_QUERY)
  })

  it('collapses a show ticked off many times into one row', () => {
    const episodes = {
      completedItems: undefined,
      watchedItems: [
        title(1399, 'Game of Thrones', {
          type: 'series',
          season: 1,
          episode: 1,
        }),
        title(1399, 'Game of Thrones', {
          type: 'series',
          season: 1,
          episode: 2,
        }),
        title(1399, 'Game of Thrones', {
          type: 'series',
          season: 2,
          episode: 1,
        }),
      ],
    }
    expect(searchLibrary(episodes, 'thrones')).toHaveLength(1)
  })

  it('stops at the limit rather than returning a wall', () => {
    const many = Array.from({ length: 200 }, (_, i) => title(i, `Rocky ${i}`))
    expect(searchLibrary({ watchlist: many }, 'rocky', 10)).toHaveLength(10)
  })
})

describe('withoutSelected', () => {
  it('removes every row for a selected title, episodes included', () => {
    // Selecting one row for a show means the show, not episode four — which is
    // otherwise forty separate removals.
    const rows = [
      title(1399, 'Game of Thrones', { type: 'series', season: 1, episode: 1 }),
      title(1399, 'Game of Thrones', { type: 'series', season: 1, episode: 2 }),
      HEAT,
    ]
    expect(withoutSelected(rows, [rows[0]])).toEqual([HEAT])
  })

  it('leaves a title of a different type alone', () => {
    const film = title(1399, 'Something Else')
    expect(withoutSelected([film, GOT], [GOT])).toEqual([film])
  })
})

describe('withAdded', () => {
  it('does not add a title that is already there', () => {
    expect(withAdded([HEAT], [HEAT, AMELIE])).toEqual([AMELIE, HEAT])
  })

  it('drops the episode fields — a show is saved as a show', () => {
    const episode = title(1399, 'Game of Thrones', {
      type: 'series',
      season: 3,
      episode: 9,
    })
    const [added] = withAdded([], [episode])
    expect(added.season).toBeUndefined()
    expect(added.episode).toBeUndefined()
    expect(added.id).toBe(1399)
  })
})
