import type { Season } from '@/types/series-details'

// The season picker is a row of tabs, not a dropdown. A dropdown said "Season 1"
// in a 44px box and hid how many seasons there were behind a click; the row
// shows them all, and the two rules it runs on are pure so they are tests.

export interface SeasonTab {
  season: number
  label: string
  episodeCount: number
  airDate?: string
}

// Season 0 is TMDB's "Specials" bucket: off the list, as it always was.
// A custom name ("Book One: Water") reads as "Season 1" — the number is what a
// viewer navigates by, and a row of long names would not fit a phone.
export function seasonTabsOf(seasons: Season[] | undefined): SeasonTab[] {
  return (seasons ?? [])
    .filter((season) => season.season_number > 0)
    .map((season) => ({
      season: season.season_number,
      label: season.name?.startsWith('Season')
        ? season.name
        : `Season ${season.season_number}`,
      episodeCount: season.episode_count,
      airDate: season.air_date || undefined,
    }))
}

/**
 * Where focus goes from tab `index` on `key`, or null when the key is not
 * one the row handles. Arrows wrap, Home/End jump — the WAI-ARIA tabs pattern.
 */
export function stepTab(
  index: number,
  key: string,
  count: number
): number | null {
  if (count < 1) return null
  if (key === 'ArrowRight') return (index + 1) % count
  if (key === 'ArrowLeft') return (index - 1 + count) % count
  if (key === 'Home') return 0
  if (key === 'End') return count - 1
  return null
}

/** "7 episodes · 2008" — the line under the row for the selected season. */
export function seasonMeta(tab: SeasonTab | undefined): string {
  if (!tab) return ''
  const parts: string[] = []
  if (tab.episodeCount) {
    parts.push(
      `${tab.episodeCount} episode${tab.episodeCount === 1 ? '' : 's'}`
    )
  }
  if (tab.airDate) parts.push(tab.airDate.slice(0, 4))
  return parts.join(' · ')
}

// A season opens whole unless it is long. Most are 6-16 episodes; a 24-episode
// network season or a daily show would push the synopsis and cast thousands of
// pixels down on a phone, so those open on 12 and a "Show all" — never to fold
// away a single card, and always far enough to include the episode the visitor
// is on (focusIndex, -1 for none), so "Up next" is never behind the button.
const OPENS_WHOLE_UP_TO = 16
const LONG_SEASON_OPENS_ON = 12

export function episodesShownAtFirst(
  total: number,
  focusIndex: number
): number {
  if (total <= OPENS_WHOLE_UP_TO) return total
  return Math.min(total, Math.max(LONG_SEASON_OPENS_ON, focusIndex + 4))
}
