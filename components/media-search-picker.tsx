'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Plus, Search } from 'lucide-react'
import { useDebounce } from 'use-debounce'

import { searchMediaApi } from '@/lib/api-client'
import { cardKey, toMatchCard, type MatchCard } from '@/lib/match-night'
import { getThumbPosterURL } from '@/lib/utils'
import { Input } from '@/components/ui/input'

// Search a title and pick one. Written once because two rooms need exactly
// this: Match Night queues the pick as the next card, Watch Together opens a
// room on it. Both used to be a different answer to "what do you want to
// watch?" - one a bespoke list, the other a box asking you to paste a URL.
//
// The same /api/search the header's command menu uses. No new endpoint, no new
// TMDB traffic pattern, and the Worker already edge-caches the query.

const RESULT_LIMIT = 6

export interface MediaSearchPickerProps {
  label: string
  placeholder: string
  onPick: (card: MatchCard) => void
  /** Cards already spoken for, by `cardKey`. Their rows render disabled. */
  takenKeys?: Set<string>
  /** What a taken row says instead of the add icon. */
  takenLabel?: string
  /** id of the input, so a caller can focus it from elsewhere on the page. */
  inputId?: string
}

export function MediaSearchPicker({
  label,
  placeholder,
  onPick,
  takenKeys,
  takenLabel = 'Queued',
  inputId = 'media-search',
}: MediaSearchPickerProps) {
  const [term, setTerm] = React.useState('')
  const [debounced] = useDebounce(term.trim(), 300)

  const { data, isFetching } = useQuery({
    queryKey: ['media-search', debounced],
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
        htmlFor={inputId}
        className="text-xs font-medium text-muted-foreground"
      >
        {label}
      </label>
      <div className="relative mt-2">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          id={inputId}
          data-testid="media-search"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder={placeholder}
          className="pl-9"
          autoComplete="off"
        />
        {isFetching ? (
          <Loader2
            className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
            aria-hidden
          />
        ) : null}
      </div>

      {showEmpty ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Nothing by that name. Try fewer words.
        </p>
      ) : null}

      {results.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {results.map((card) => {
            const taken = takenKeys?.has(cardKey(card)) ?? false
            return (
              <li key={cardKey(card)}>
                <button
                  type="button"
                  disabled={taken}
                  onClick={() => {
                    onPick(card)
                    setTerm('')
                  }}
                  className="flex w-full items-center gap-3 rounded-lg p-1.5 text-left transition hover:bg-muted/60 disabled:opacity-50"
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
                    <div className="h-14 w-10 shrink-0 rounded-sm bg-muted" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {card.title}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {card.mediaType === 'tv' ? 'Series' : 'Film'}
                      {card.year ? ` · ${card.year}` : ''}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {taken ? (
                      takenLabel
                    ) : (
                      <Plus className="size-4" aria-label="Pick this title" />
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
