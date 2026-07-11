'use client'

import { useQuery } from '@tanstack/react-query'
import { getGenreListAction } from '@/actions/genres'

import { ItemType } from '@/types/movie-result'
import { MOVIES_GENRE, TV_GENRE } from '@/lib/genres'

/**
 * The TMDB genre list for a media type, fetched via a long-cached server action
 * and backed by the bundled static list. The static list renders instantly as
 * placeholder data (so filter chips never pop in), then the live list replaces
 * it once resolved. Any failure keeps the static list — genres never go blank.
 */
export function useGenres(mediaType: ItemType) {
  const fallback = mediaType === 'tv' ? TV_GENRE : MOVIES_GENRE

  const { data } = useQuery({
    queryKey: ['genres', mediaType],
    queryFn: () => getGenreListAction(mediaType),
    placeholderData: fallback,
    staleTime: 1000 * 60 * 60 * 24, // 1 day — matches how rarely genres change
  })

  return data?.length ? data : fallback
}
