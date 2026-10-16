'use client'

import * as React from 'react'

import { SeriesDetails } from '@/types/series-details'
import { trackSeasonSelected } from '@/lib/analytics'
import { seasonTabsOf, stepTab } from '@/lib/season-tabs'
import { cn } from '@/lib/utils'
import { NewBadgeWhenRecent } from '@/components/new-badge-when-recent'

export const EPISODES_PANEL_ID = 'episodes-panel'
export const seasonTabId = (season: string | number) => `season-tab-${season}`

interface SeasonsSelectorProps {
  series: SeriesDetails
  selectedSeason: string
  onSeasonChange: (season: string) => void
}

/**
 * Every season, in one row of tabs.
 *
 * This was a Radix <Select>: one 44px box reading "Season 1" in the corner of a
 * 288px column, so how many seasons a show had, and that there was anything
 * to pick at all, was one click away. A row shows them all. On a phone it
 * scrolls sideways under a fade, and the selected tab is brought into view.
 *
 * Manual activation (arrows move focus, Enter/Space or a click selects), not
 * automatic: every selection is a season fetch, and arrowing across a long
 * show would fire one per tab passed over.
 *
 * Controlled, not uncontrolled: continue-watching can move the selection to the
 * resumed season after mount.
 */
export function SeasonsSelector({
  series,
  selectedSeason,
  onSeasonChange,
}: SeasonsSelectorProps) {
  const tabs = React.useMemo(() => seasonTabsOf(series?.seasons), [series])
  const listRef = React.useRef<HTMLDivElement>(null)
  const tabRefs = React.useRef<(HTMLButtonElement | null)[]>([])

  const select = (season: number) => {
    if (String(season) === selectedSeason) return
    trackSeasonSelected({ media_id: series?.id, season })
    onSeasonChange(String(season))
  }

  // Bring the selected tab into view inside the row — by scrolling the ROW.
  // scrollIntoView would scroll the page as well, pulling the visitor down to
  // the episodes the moment a resumed season was picked for them.
  React.useEffect(() => {
    const list = listRef.current
    const index = tabs.findIndex((tab) => String(tab.season) === selectedSeason)
    const tab = tabRefs.current[index]
    if (!list || !tab) return
    const target = tab.offsetLeft - (list.clientWidth - tab.offsetWidth) / 2
    list.scrollLeft = Math.max(0, target)
  }, [selectedSeason, tabs])

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    const next = stepTab(index, event.key, tabs.length)
    if (next === null) return
    event.preventDefault()
    tabRefs.current[next]?.focus()
  }

  if (!tabs.length) return null

  return (
    // The fade tells a phone there is more to the right; it is a mask, so it
    // fades whatever is under it rather than painting a colour that has to
    // match the page.
    <div
      ref={listRef}
      role="tablist"
      aria-label="Seasons"
      className="no-scrollbar -mx-5 flex snap-x scroll-px-5 gap-2 overflow-x-auto mask-[linear-gradient(to_right,#000_calc(100%-2.5rem),transparent)] px-5 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:mask-none sm:px-0"
    >
      {tabs.map((tab, index) => {
        const selected = String(tab.season) === selectedSeason
        return (
          <button
            key={tab.season}
            ref={(node) => {
              tabRefs.current[index] = node
            }}
            type="button"
            role="tab"
            id={seasonTabId(tab.season)}
            aria-selected={selected}
            aria-controls={EPISODES_PANEL_ID}
            tabIndex={selected ? 0 : -1}
            onClick={() => select(tab.season)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              'relative flex h-11 shrink-0 snap-start items-center gap-2 rounded-full px-4 text-sm font-semibold whitespace-nowrap transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-hidden motion-reduce:transition-none',
              selected
                ? 'bg-foreground text-background'
                : 'bg-white/6 text-muted-foreground ring-1 ring-white/10 ring-inset hover:bg-white/10 hover:text-foreground'
            )}
          >
            {tab.label}
            <NewBadgeWhenRecent
              date={tab.airDate}
              label="New"
              className="static -my-1 px-1.5 py-0 text-[10px]"
            />
          </button>
        )
      })}
    </div>
  )
}
