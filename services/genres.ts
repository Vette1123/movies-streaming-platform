import { cache } from 'react'

import { MovieGenre } from '@/types/movie-genre'
import { ItemType } from '@/types/movie-result'
import { fetchClient } from '@/lib/fetch-client'
import { MOVIES_GENRE, TV_GENRE } from '@/lib/genres'

// TMDB's genre lists are canonical and change at most once or twice a year, so
// cache them for 30 days — the fetch is essentially free and never pressures
// the Cloudflare free-plan KV write cap. The bundled static lists in
// `lib/genres.ts` remain the fail-soft fallback so a TMDB hiccup (or missing
// credentials) never blanks out genres.
const GENRE_REVALIDATE = 60 * 60 * 24 * 30

interface GenreListResponse {
  genres: MovieGenre[]
}

const staticGenres = (mediaType: ItemType): MovieGenre[] =>
  mediaType === 'tv' ? TV_GENRE : MOVIES_GENRE

/**
 * The official TMDB genre list for the given media type, fetched live and
 * long-cached. Falls back to the bundled static list on any failure, so callers
 * always receive a usable, non-empty list.
 */
const getGenreList = cache(
  async (mediaType: ItemType): Promise<MovieGenre[]> => {
    try {
      const data = await fetchClient.get<GenreListResponse>(
        `genre/${mediaType}/list?language=en-US`,
        {},
        true,
        GENRE_REVALIDATE
      )
      return data?.genres?.length ? data.genres : staticGenres(mediaType)
    } catch {
      return staticGenres(mediaType)
    }
  }
)

export { getGenreList }
