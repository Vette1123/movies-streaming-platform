'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Plus, Search } from 'lucide-react'
import { useDebounce } from 'use-debounce'

import { searchMediaApi } from '@/lib/api-client'
import { toMatchCard, type MatchCard } from '@/lib/match-night'
import { getThumbPosterURL } from '@/lib/utils'
import { Input } from '@/components/ui/input'

// Search inside Match Night. The deck is trending, which is fine until one of
// you has a specific title in mind - before this there was no way to put it in
// front of the room at all, so the answer to "what about that one?" was to
// leave the page. A hit is queued as the NEXT card rather than appended, so it
// is voted on while it is still the thing being talked about.
//
// The same /api/search the header's command menu uses. No new endpoint, no new
// TMDB traffic pattern, and the Worker already edge-caches the query.

const RESULT_LIMIT = 6

export function DeckSearch({
  onQueue,
  queuedIds,
}: {
  onQueue: (card: MatchCard) => void
  queuedIds: Set<number>
}) {
  const [term, setTerm] = React.useState('')
  const [debounced] = useDebounce(term.trim(), 300)

  const { data, isFetching } = useQuery({
    queryKey: ['match-search', debounced],
    enabled: debounced.length > 1,
    staleTime: 5 * 60 * 1000,
    queryFn: () => searchMediaApi(debounced),
  })

  const results = React.useMemo<MatchCard[]>(() => {
    const rows = data?.results ?? []
    return rows
      .filter((row) => String(row.media_type) !== 'person' && row.poster_path)
      .slice(0, RESULT_LIMIT)
      .map((row) => toMatchCard(row, 'movie'))
  }, [data])

  const showEmpty = debounced.length > 1 && !isFetching && results.length === 0

  return (
    <div>
      <label
        htmlFor="match-search"
        className="text-muted-foreground text-xs font-medium"
      >
        Something specific in mind?
      </label>
      <div className="relative mt-2">
        <Search
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden
        />
        <Input
          id="match-search"
          data-testid="match-search"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search any film or series"
          className="pl-9"
          autoComplete="off"
        />
        {isFetching ? (
          <Loader2
            className="text-muted-foreground absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin"
            aria-hidden
          />
        ) : null}
      </div>

      {showEmpty ? (
        <p className="text-muted-foreground mt-3 text-xs">
          Nothing by that name. Try fewer words.
        </p>
      ) : null}

      {results.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {results.map((card) => {
            const queued = queuedIds.has(card.id)
            return (
              <li key={`${card.mediaType}-${card.id}`}>
                <button
                  type="button"
                  disabled={queued}
                  onClick={() => {
                    onQueue(card)
                    setTerm('')
                  }}
                  className="hover:bg-muted/60 flex w-full items-center gap-3 rounded-lg p-1.5 text-left transition disabled:opacity-50"
                >
                  {card.poster ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={getThumbPosterURL(card.poster)}
                      alt=""
                      loading="lazy"
                      className="h-14 w-10 shrink-0 rounded-sm object-cover"
                    />
                  ) : (
                    <div className="bg-muted h-14 w-10 shrink-0 rounded-sm" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {card.title}
                    </span>
                    <span className="text-muted-foreground block text-xs">
                      {card.mediaType === 'tv' ? 'Series' : 'Film'}
                      {card.year ? ` · ${card.year}` : ''}
                    </span>
                  </span>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {queued ? (
                      'Queued'
                    ) : (
                      <Plus className="size-4" aria-label="Add to the deck" />
                    )}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
