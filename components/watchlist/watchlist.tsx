'use client'

import React from 'react'
import { Bookmark, Film, Tv } from 'lucide-react'
import { toast } from 'sonner'

import { useMounted } from '@/hooks/use-mounted'
import { useWatchlist } from '@/hooks/use-watchlist'
import { EmptyState } from '@/components/ui/empty-state'
import { WatchedItemCard } from '@/components/watch-history/watch-history-card'
import { WatchedItemCardSkeleton } from '@/components/watch-history/watch-history-skeleton'

export const WatchlistContainer = () => {
  const { watchlist, remove } = useWatchlist()
  const isMounted = useMounted()

  const handleRemove = (id: number) => {
    const item = watchlist.find((entry) => entry.id === id)
    remove(id)
    if (item) toast(`Removed “${item.title}” from your watchlist`)
  }

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
      <EmptyState
        icon={Bookmark}
        title="Your watchlist is empty"
        description="Save any movie or show and it’ll wait for you right here — ready whenever you are."
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
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 lg:grid-cols-5">
        {watchlist
          ?.slice()
          ?.sort(
            (a, b) =>
              new Date(b.added_at).getTime() - new Date(a.added_at).getTime()
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
