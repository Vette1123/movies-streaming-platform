'use client'

import React from 'react'

import { useFavorites } from '@/hooks/use-favorites'
import { useMounted } from '@/hooks/use-mounted'
import { MediaType } from '@/types/media'
import { ItemType } from '@/types/movie-result'
import { Card } from '@/components/card'
import { WatchedItemCardSkeleton } from '@/components/watch-history/watch-history-skeleton'
import { ClearWatchlistAlert } from '@/components/watchlist/clear-watchlist-alert'

export const WatchlistContainer = () => {
  const { favorites, clearAll } = useFavorites()
  const isMounted = useMounted()

  if (!isMounted) {
    return (
      <div className="flex flex-wrap gap-4">
        {Array.from({ length: 10 }).map((_, index) => (
          <WatchedItemCardSkeleton key={index} />
        ))}
      </div>
    )
  }

  if (!favorites.length) {
    return (
      <div className="flex min-h-[50vh] flex-1 flex-col items-center justify-center gap-2">
        <p className="text-lg text-muted-foreground">No favorites yet</p>
        <p className="text-sm text-muted-foreground/60">
          Hit the heart icon on any movie or show to save it here
        </p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {favorites.length} {favorites.length === 1 ? 'title' : 'titles'} saved
        </p>
        <ClearWatchlistAlert onClear={clearAll} />
      </div>
      <div className="flex flex-wrap gap-4">
        {favorites
          .sort(
            (a, b) =>
              new Date(b.added_at).getTime() - new Date(a.added_at).getTime()
          )
          .map((item) => {
            const mediaItem: MediaType = {
              id: item.id,
              title: item.title,
              original_title: item.title,
              overview: '',
              poster_path: item.poster_path,
              backdrop_path: '',
              release_date: item.release_date || '',
              vote_average: item.vote_average || 0,
              vote_count: 0,
              genre_ids: [],
              adult: false,
              original_language: '',
              popularity: 0,
              video: false,
              media_type: item.type === 'series' ? 'tv' : 'movie',
            }
            const itemType: ItemType = item.type === 'series' ? 'tv' : 'movie'
            return <Card key={item.id} item={mediaItem} itemType={itemType} />
          })}
      </div>
    </div>
  )
}
