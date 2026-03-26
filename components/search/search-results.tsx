'use client'

import React, { useState } from 'react'
import { ArrowUpDown } from 'lucide-react'

import { MediaType } from '@/types/media'
import { MOVIES_GENRE, TV_GENRE } from '@/lib/genres'
import { cn } from '@/lib/utils'
import { Card } from '@/components/card'

const ALL_GENRES = [...MOVIES_GENRE, ...TV_GENRE].filter(
  (g, i, arr) => arr.findIndex((x) => x.id === g.id) === i
)

type SortMode = 'relevance' | 'rating'

export function SearchResults({ results }: { results: MediaType[] }) {
  const [activeGenre, setActiveGenre] = useState<number | null>(null)
  const [sortMode, setSortMode] = useState<SortMode>('relevance')

  if (!results.length) return null

  const presentIds = new Set(results.flatMap((r) => r.genre_ids ?? []))
  const availableGenres = ALL_GENRES.filter((g) => presentIds.has(g.id))

  const filtered =
    activeGenre === null
      ? results
      : results.filter((r) => r.genre_ids?.includes(activeGenre))

  const sorted =
    sortMode === 'rating'
      ? [...filtered].sort((a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0))
      : filtered

  return (
    <div className="space-y-5">
      {/* Genre filter pills */}
      {availableGenres.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveGenre(null)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              activeGenre === null
                ? 'border-white bg-white text-black'
                : 'border-white/20 text-white/70 hover:border-white/40 hover:text-white'
            )}
          >
            All
          </button>
          {availableGenres.map((genre) => (
            <button
              key={genre.id}
              onClick={() =>
                setActiveGenre(activeGenre === genre.id ? null : genre.id)
              }
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                activeGenre === genre.id
                  ? 'border-white bg-white text-black'
                  : 'border-white/20 text-white/70 hover:border-white/40 hover:text-white'
              )}
            >
              {genre.name}
            </button>
          ))}
        </div>
      )}

      {/* Result count + sort toggle */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {sorted.length} result{sorted.length !== 1 ? 's' : ''}
          {activeGenre !== null &&
            ` in ${ALL_GENRES.find((g) => g.id === activeGenre)?.name}`}
        </p>
        <button
          onClick={() =>
            setSortMode((m) => (m === 'relevance' ? 'rating' : 'relevance'))
          }
          className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60 transition-colors hover:border-white/20 hover:text-white/80"
        >
          <ArrowUpDown className="size-3" />
          {sortMode === 'relevance' ? 'Sort: Relevance' : 'Sort: Rating'}
        </button>
      </div>

      {sorted.length === 0 ? (
        <div className="flex min-h-[20vh] items-center justify-center">
          <p className="text-sm text-muted-foreground">
            No results for this genre
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-4">
          {sorted.map((item) => (
            <Card
              key={item.id}
              item={item}
              itemType={item.media_type === 'tv' ? 'tv' : 'movie'}
            />
          ))}
        </div>
      )}
    </div>
  )
}
