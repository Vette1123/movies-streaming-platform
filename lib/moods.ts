// The mood picker: curated discover presets. A mood is a genre cocktail plus
// a quality floor — no new backend surface, it compiles down to the same
// /api/filter discover call the browse pages already make.

export interface Mood {
  id: string
  label: string
  emoji: string
  blurb: string
  /** TMDB genre ids, OR-ed by TMDB when joined with a pipe. */
  genres: number[]
  /** The same mood in TV's genre vocabulary, which is a different list: no
   * horror, no romance, no sci-fi — Action & Adventure (10759), Sci-Fi &
   * Fantasy (10765) and Mystery (9648) carry those instead. Reusing the movie
   * ids returns an empty shelf, not a wrong one, which is worse. */
  tvGenres: number[]
  sortBy: 'popularity.desc' | 'vote_average.desc'
  voteAverageGte: number
}

// Genre ids are TMDB's own: 35 comedy, 10751 family, 16 animation,
// 9648 mystery, 878 sci-fi, 28 action, 53 thriller, 18 drama, 10749 romance,
// 27 horror, 36 history, 99 documentary, 12 adventure, 14 fantasy, 10402 music.
//
// TV has its own list and it is shorter: 10759 action & adventure, 10765
// sci-fi & fantasy, 10768 war & politics, 10766 soap, 80 crime, 99 documentary,
// 18 drama, 35 comedy, 16 animation, 10751 family, 9648 mystery.
export const MOODS: Mood[] = [
  {
    id: 'cozy',
    label: 'Cozy & warm',
    emoji: '🕯️',
    blurb: 'Blanket, snack, no surprises',
    genres: [10751, 35, 16],
    tvGenres: [10751, 35, 16],
    sortBy: 'vote_average.desc',
    voteAverageGte: 7,
  },
  {
    id: 'adrenaline',
    label: 'Adrenaline',
    emoji: '⚡',
    blurb: 'Loud, fast, gripping',
    genres: [28, 53],
    tvGenres: [10759, 80],
    sortBy: 'popularity.desc',
    voteAverageGte: 6.5,
  },
  {
    id: 'mindbend',
    label: 'Mind-bending',
    emoji: '🌀',
    blurb: 'You will think about it tomorrow',
    genres: [9648, 878],
    tvGenres: [9648, 10765],
    sortBy: 'vote_average.desc',
    voteAverageGte: 7,
  },
  {
    id: 'laugh',
    label: 'Make me laugh',
    emoji: '😂',
    blurb: 'Zero stakes, all jokes',
    genres: [35],
    tvGenres: [35],
    sortBy: 'vote_average.desc',
    voteAverageGte: 7,
  },
  {
    id: 'cry',
    label: 'Emotional damage',
    emoji: '😭',
    blurb: 'Crying is the point',
    genres: [18, 10749],
    tvGenres: [18, 10766],
    sortBy: 'vote_average.desc',
    voteAverageGte: 7.5,
  },
  {
    id: 'scare',
    label: 'Scare me',
    emoji: '👻',
    blurb: 'Lights off, volume up',
    genres: [27, 9648],
    tvGenres: [9648, 10765],
    sortBy: 'popularity.desc',
    voteAverageGte: 6,
  },
  {
    id: 'truestory',
    label: 'True story',
    emoji: '📜',
    blurb: 'It actually happened',
    genres: [36, 99],
    tvGenres: [99, 10768],
    sortBy: 'vote_average.desc',
    voteAverageGte: 7,
  },
  {
    id: 'escape',
    label: 'Escape reality',
    emoji: '🐉',
    blurb: 'Other worlds, bigger stakes',
    genres: [14, 12, 878],
    tvGenres: [10765, 10759],
    sortBy: 'popularity.desc',
    voteAverageGte: 6.5,
  },
]

/** The discover filter set a mood compiles to, per media type.
 *
 * The vote floors differ per type on purpose. Sorting by rating with too low
 * a floor surfaces titles nobody has heard of - measured on TV comedy, 100
 * votes returned Regular Show: The Lost Tapes and Pa Quererte, 400 returned
 * Rick and Morty and One Piece - while the narrowest mood (documentary and
 * war & politics) still has 48 pages at 400. */
export const moodToFilters = (
  mood: Mood,
  mediaType: 'movie' | 'tv' = 'movie'
) => ({
  with_genres: (mediaType === 'tv' ? mood.tvGenres : mood.genres).join('|'),
  sort_by: mood.sortBy,
  'vote_average.gte': mood.voteAverageGte,
  'vote_count.gte': mediaType === 'tv' ? 400 : 300,
})

export const moodById = (id: string | null): Mood | undefined =>
  MOODS.find((mood) => mood.id === id)
