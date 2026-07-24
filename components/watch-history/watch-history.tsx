'use client'

import React from 'react'
import { History } from 'lucide-react'
import { toast } from 'sonner'

import { useMounted } from '@/hooks/use-mounted'
import { useWatchedMedia } from '@/hooks/use-watched-media'
import { WatchedItemsGrid } from '@/components/watch-history/watched-items-grid'

import { DeleteHistoryAlert } from './delete-alert'

export const WatchHistoryContainer = () => {
  const { watchedItems, deleteWatchedItems, removeWatchedItem } =
    useWatchedMedia()
  const isMounted = useMounted()

  const handleRemove = (id: number) => {
    const item = watchedItems.find((entry) => entry.id === id)
    removeWatchedItem(id)
    if (item) toast(`Removed “${item.title}” from your watch history`)
  }

  return (
    <WatchedItemsGrid
      items={watchedItems}
      isMounted={isMounted}
      onRemove={handleRemove}
      sortBy="modified_at"
      empty={{
        icon: History,
        title: 'No watch history yet',
        description:
          'Titles you play show up here, so you can always pick up right where you left off.',
      }}
      toolbar={<DeleteHistoryAlert onDelete={deleteWatchedItems} />}
    />
  )
}
