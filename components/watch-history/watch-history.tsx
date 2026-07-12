'use client'

import React from 'react'
import { Film, History, Tv } from 'lucide-react'
import { toast } from 'sonner'

import { useMounted } from '@/hooks/use-mounted'
import { useWatchedMedia } from '@/hooks/use-watched-media'
import { EmptyState } from '@/components/ui/empty-state'

import { DeleteHistoryAlert } from './delete-alert'
import { WatchedItemCard } from './watch-history-card'
import { WatchedItemCardSkeleton } from './watch-history-skeleton'

export const WatchHistoryContainer = () => {
  const { watchedItems, deleteWatchedItems, removeWatchedItem } =
    useWatchedMedia()
  const isMounted = useMounted()

  const handleRemove = (id: number) => {
    const item = watchedItems.find((entry) => entry.id === id)
    removeWatchedItem(id)
    if (item) toast(`Removed “${item.title}” from your watch history`)
  }

  if (!isMounted) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5 lg:gap-8">
        {Array.from({ length: 10 }).map((_, index) => (
          <WatchedItemCardSkeleton key={index} />
        ))}
      </div>
    )
  }

  if (!watchedItems.length) {
    return (
      <EmptyState
        icon={History}
        title="No watch history yet"
        description="Titles you play show up here, so you can always pick up right where you left off."
        primaryAction={{ href: '/movies', label: 'Browse movies', icon: Film }}
        secondaryAction={{
          href: '/tv-shows',
          label: 'Explore series',
          icon: Tv,
        }}
      />
    )
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <div className="mb-2 flex justify-end">
        {/* clear history */}
        <DeleteHistoryAlert onDelete={deleteWatchedItems} />
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 lg:grid-cols-5">
        {watchedItems
          ?.sort(
            (a, b) =>
              new Date(b.modified_at).getTime() -
              new Date(a.modified_at).getTime()
          )
          ?.map((item) => (
            <WatchedItemCard
              key={item.id}
              item={item}
              onRemove={handleRemove}
            />
          ))}
      </div>
    </div>
  )
}
