'use client'

import React from 'react'
import { Film, Tv, type LucideIcon } from 'lucide-react'

import { WatchedItem } from '@/hooks/use-local-storage'
import { EmptyState } from '@/components/ui/empty-state'
import { WatchedItemCard } from '@/components/watch-history/watch-history-card'
import { WatchedItemCardSkeleton } from '@/components/watch-history/watch-history-skeleton'

interface WatchedItemsGridProps {
  items: WatchedItem[]
  // localStorage is client-only; false on the server / first client render so we
  // emit the skeleton and stay hydration-safe.
  isMounted: boolean
  onRemove: (id: number) => void
  // Newest-first key: watchlist orders by save time, history by last play.
  sortBy: 'added_at' | 'modified_at'
  empty: {
    icon: LucideIcon
    title: string
    description: string
  }
  // Optional header slot (e.g. the watch-history "Clear all" alert).
  toolbar?: React.ReactNode
}

// Shared shell for the watchlist and watch-history pages — identical skeleton,
// empty state, and sorted card grid; only the data source, sort key, empty copy,
// and the optional toolbar differ.
export const WatchedItemsGrid = ({
  items,
  isMounted,
  onRemove,
  sortBy,
  empty,
  toolbar,
}: WatchedItemsGridProps) => {
  if (!isMounted) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5 lg:gap-8">
        {Array.from({ length: 10 }).map((_, index) => (
          <WatchedItemCardSkeleton key={index} />
        ))}
      </div>
    )
  }

  if (!items.length) {
    return (
      <EmptyState
        icon={empty.icon}
        title={empty.title}
        description={empty.description}
        primaryAction={{ href: '/movies', label: 'Browse movies', icon: Film }}
        secondaryAction={{
          href: '/tv-shows',
          label: 'Explore series',
          icon: Tv,
        }}
      />
    )
  }

  const sorted = items
    .slice()
    .sort(
      (a, b) => new Date(b[sortBy]).getTime() - new Date(a[sortBy]).getTime()
    )

  return (
    // No min-height here: the shell in app/layout.tsx is the full-height column
    // now, so a second viewport-tall box inside it only pushed the footer a
    // screen below the fold when the grid held two rows.
    <div className="flex flex-1 flex-col">
      {toolbar && <div className="mb-2 flex justify-end">{toolbar}</div>}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 lg:grid-cols-5">
        {sorted.map((item) => (
          <WatchedItemCard key={item.id} item={item} onRemove={onRemove} />
        ))}
      </div>
    </div>
  )
}
