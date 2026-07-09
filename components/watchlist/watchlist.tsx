'use client'

import React from 'react'

import { useMounted } from '@/hooks/use-mounted'
import { useWatchlist } from '@/hooks/use-watchlist'
import { WatchedItemCard } from '@/components/watch-history/watch-history-card'
import { WatchedItemCardSkeleton } from '@/components/watch-history/watch-history-skeleton'

export const WatchlistContainer = () => {
  const { watchlist } = useWatchlist()
  const isMounted = useMounted()

  // localStorage is client-only — render skeletons on the server / first client
  // render so the markup matches (hydration-safe), then reveal the real list.
  if (!isMounted) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5 lg:gap-8">
        {Array.from({ length: 10 }).map((_, index) => (
          <WatchedItemCardSkeleton key={index} />
        ))}
      </div>
    )
  }

  if (!watchlist.length) {
    return (
      <div className="flex min-h-screen flex-1 flex-col items-center">
        <p className="text-lg text-gray-500">Your watchlist is empty</p>
        <p className="text-sm text-gray-400">
          Tap “Save” on any movie or show to keep it here for later
        </p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 lg:grid-cols-5">
        {watchlist
          ?.slice()
          ?.sort(
            (a, b) =>
              new Date(b.added_at).getTime() - new Date(a.added_at).getTime()
          )
          ?.map((item) => (
            <WatchedItemCard key={item.id} item={item} />
          ))}
      </div>
    </div>
  )
}
