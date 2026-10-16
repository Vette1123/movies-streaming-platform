import { describe, expect, it } from 'vitest'

import type { Season } from '@/types/series-details'
import {
  episodesShownAtFirst,
  seasonMeta,
  seasonTabsOf,
  stepTab,
} from '@/lib/season-tabs'

const season = (n: number, name: string, count = 10): Season => ({
  air_date: `20${10 + n}-01-01`,
  episode_count: count,
  id: n,
  name,
  overview: '',
  poster_path: null,
  season_number: n,
  vote_average: 0,
})

describe('seasonTabsOf', () => {
  it('drops the specials and numbers custom names', () => {
    const tabs = seasonTabsOf([
      season(0, 'Specials'),
      season(1, 'Season 1', 7),
      season(2, 'Book Two: Earth', 20),
    ])
    expect(tabs.map((tab) => tab.label)).toEqual(['Season 1', 'Season 2'])
    expect(tabs[1]).toMatchObject({ season: 2, episodeCount: 20 })
  })

  it('survives a payload with no seasons', () => {
    expect(seasonTabsOf(undefined)).toEqual([])
  })
})

describe('stepTab', () => {
  it('wraps the arrows and jumps on Home/End', () => {
    expect(stepTab(4, 'ArrowRight', 5)).toBe(0)
    expect(stepTab(0, 'ArrowLeft', 5)).toBe(4)
    expect(stepTab(2, 'Home', 5)).toBe(0)
    expect(stepTab(2, 'End', 5)).toBe(4)
  })

  it('leaves every other key to the browser', () => {
    expect(stepTab(1, 'Enter', 5)).toBeNull()
    expect(stepTab(1, 'Tab', 5)).toBeNull()
    expect(stepTab(0, 'ArrowRight', 0)).toBeNull()
  })
})

describe('seasonMeta', () => {
  it('says how many episodes and which year', () => {
    expect(seasonMeta(seasonTabsOf([season(1, 'Season 1', 7)])[0])).toBe(
      '7 episodes · 2011'
    )
    expect(seasonMeta(seasonTabsOf([season(2, 'Season 2', 1)])[0])).toBe(
      '1 episode · 2012'
    )
    expect(seasonMeta(undefined)).toBe('')
  })
})

describe('episodesShownAtFirst', () => {
  it('opens an ordinary season whole', () => {
    expect(episodesShownAtFirst(13, -1)).toBe(13)
    expect(episodesShownAtFirst(16, -1)).toBe(16)
  })

  it('folds a long season, but never past the episode you are on', () => {
    expect(episodesShownAtFirst(24, -1)).toBe(12)
    expect(episodesShownAtFirst(24, 19)).toBe(23)
    expect(episodesShownAtFirst(24, 22)).toBe(24)
  })
})
