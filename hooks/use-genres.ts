import { ItemType } from '@/types/movie-result'
import { MOVIES_GENRE, TV_GENRE } from '@/lib/genres'

/**
 * The TMDB genre list for a media type: the bundled list, nothing fetched.
 *
 * It used to be replaced by /api/genres after paint. TMDB's genre list has not
 * changed in years, and on 2026-11-20/21 that call was the first challenged
 * request for visitors landing on /movies and /tv-shows (7 of 31 api_errors),
 * an invocation plus a security check bought for a list we already ship.
 * The Worker route stays for old tabs.
 */
export function useGenres(mediaType: ItemType) {
  return mediaType === 'tv' ? TV_GENRE : MOVIES_GENRE
}
