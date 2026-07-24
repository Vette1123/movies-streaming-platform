'use client'

import React from 'react'
import { Bookmark } from 'lucide-react'
import { toast } from 'sonner'

import { useMounted } from '@/hooks/use-mounted'
import { useWatchlist } from '@/hooks/use-watchlist'
import { WatchedItemsGrid } from '@/components/watch-history/watched-items-grid'

export const WatchlistContainer = () => {
  const { watchlist, remove } = useWatchlist()
  const isMounted = useMounted()

  const handleRemove = (id: number) => {
    const item = watchlist.find((entry) => entry.id === id)
    remove(id)
    if (item) toast(`Removed “${item.title}” from your watchlist`)
  }

  return (
    <WatchedItemsGrid
      items={watchlist}
      isMounted={isMounted}
      onRemove={handleRemove}
      sortBy="added_at"
      empty={{
        icon: Bookmark,
        title: 'Your watchlist is empty',
        description:
          'Save any movie or show and it’ll wait for you right here — ready whenever you are.',
      }}
    />
  )
}
