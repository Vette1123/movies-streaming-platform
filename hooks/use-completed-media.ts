import { MovieDetails } from '@/types/movie-details'
import { useLocalStorage, WatchedItem } from '@/hooks/use-local-storage'

// Deliberately a SEPARATE localStorage key from `watchedItems` and `watchlist`.
// "completed" means the user has actually FINISHED a movie/episode — the green
// checkmark reads from this set only. `watchedItems` is play-start / continue-
// watching and `watchlist` is want-to-watch; neither implies "watched to the
// end". Keeping completion apart means pressing play never fakes a checkmark
// (the player is a cross-origin embed we can't observe, so completion is either
// confirmed manually or inferred from a later episode playing — see
// markEpisodesCompleted). Mirrors the rationale in use-watchlist.ts.
const COMPLETED_KEY = 'completedItems'

// Enough series/episode context to persist one entry PER episode. Movies store a
// single entry keyed on id; episodes store one per (id, season, episode).
export interface EpisodeCompletionMeta {
  showId: number
  season: number
  episode: number
  seriesName: string
  overview: string
  backdrop_path: string
  poster_path: string
}

interface CompletedMediaHookResult {
  completedItems: WatchedItem[]
  isMovieCompleted: (id: number) => boolean
  isEpisodeCompleted: (
    showId: number,
    season: number,
    episode: number
  ) => boolean
  toggleMovieCompleted: (movie: MovieDetails) => void
  toggleEpisodeCompleted: (meta: EpisodeCompletionMeta) => void
  markEpisodesCompleted: (metas: EpisodeCompletionMeta[]) => void
}

const episodeToItem = (meta: EpisodeCompletionMeta): WatchedItem => {
  const now = new Date().toISOString()
  return {
    id: meta.showId,
    type: 'series',
    title: meta.seriesName,
    overview: meta.overview,
    backdrop_path: meta.backdrop_path,
    poster_path: meta.poster_path,
    season: meta.season,
    episode: meta.episode,
    added_at: now,
    modified_at: now,
  }
}

export function useCompletedMedia(): CompletedMediaHookResult {
  const [completedItems, setCompletedItems] = useLocalStorage(COMPLETED_KEY, [])

  const isMovieCompleted = (id: number) =>
    completedItems.some((item) => item.type === 'movie' && item.id === id)

  const isEpisodeCompleted = (
    showId: number,
    season: number,
    episode: number
  ) =>
    completedItems.some(
      (item) =>
        item.type === 'series' &&
        item.id === showId &&
        item.season === season &&
        item.episode === episode
    )

  const toggleMovieCompleted = (movie: MovieDetails) => {
    if (isMovieCompleted(movie.id)) {
      setCompletedItems(
        completedItems.filter(
          (item) => !(item.type === 'movie' && item.id === movie.id)
        )
      )
      return
    }
    const now = new Date().toISOString()
    setCompletedItems([
      ...completedItems,
      {
        id: movie.id,
        type: 'movie',
        title: movie.title,
        overview: movie.overview,
        backdrop_path: movie.backdrop_path,
        poster_path: movie.poster_path,
        added_at: now,
        modified_at: now,
      },
    ])
  }

  const toggleEpisodeCompleted = (meta: EpisodeCompletionMeta) => {
    if (isEpisodeCompleted(meta.showId, meta.season, meta.episode)) {
      setCompletedItems(
        completedItems.filter(
          (item) =>
            !(
              item.type === 'series' &&
              item.id === meta.showId &&
              item.season === meta.season &&
              item.episode === meta.episode
            )
        )
      )
      return
    }
    setCompletedItems([...completedItems, episodeToItem(meta)])
  }

  // Bulk-add without duplicating existing entries. Used to auto-mark the episodes
  // that came before the one a user just started — the practical stand-in for
  // real completion tracking, which the opaque streaming iframe can't provide.
  const markEpisodesCompleted = (metas: EpisodeCompletionMeta[]) => {
    const additions = metas.filter(
      (meta) => !isEpisodeCompleted(meta.showId, meta.season, meta.episode)
    )
    if (!additions.length) return
    setCompletedItems([...completedItems, ...additions.map(episodeToItem)])
  }

  return {
    completedItems,
    isMovieCompleted,
    isEpisodeCompleted,
    toggleMovieCompleted,
    toggleEpisodeCompleted,
    markEpisodesCompleted,
  }
}
