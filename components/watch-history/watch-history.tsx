'use client'

import React from 'react'

import { useMounted } from '@/hooks/use-mounted'
import { useWatchedMedia } from '@/hooks/use-watched-media'

import { WatchedItemCard } from './watch-history-card'
import { WatchedItemCardSkeleton } from './watch-history-skeleton'

export const WatchHistoryContainer = () => {
  const { watchedItems } = useWatchedMedia()
  const isMounted = useMounted()

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
      <div className="flex min-h-screen flex-1 flex-col items-center">
        <p className="text-lg text-gray-500">No watched items yet</p>
        <p className="text-sm text-gray-400">
          Start watching your favorite movies and TV shows to see them here
        </p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-1">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5 lg:gap-8">
        {watchedItems?.map((item) => <WatchedItemCard item={item} />)}
      </div>
    </div>
  )
}
