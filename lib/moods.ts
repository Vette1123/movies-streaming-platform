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
  sortBy: 'popularity.desc' | 'vote_average.desc'
  voteAverageGte: number
}

// Genre ids are TMDB's own: 35 comedy, 10751 family, 16 animation,
// 9648 mystery, 878 sci-fi, 28 action, 53 thriller, 18 drama, 10749 romance,
// 27 horror, 36 history, 99 documentary, 12 adventure, 14 fantasy, 10402 music.
export const MOODS: Mood[] = [
  {
    id: 'cozy',
    label: 'Cozy & warm',
    emoji: '🕯️',
    blurb: 'Blanket, snack, no surprises',
    genres: [10751, 35, 16],
    sortBy: 'vote_average.desc',
    voteAverageGte: 7,
  },
  {
    id: 'adrenaline',
    label: 'Adrenaline',
    emoji: '⚡',
    blurb: 'Loud, fast, gripping',
    genres: [28, 53],
    sortBy: 'popularity.desc',
    voteAverageGte: 6.5,
  },
  {
    id: 'mindbend',
    label: 'Mind-bending',
    emoji: '🌀',
    blurb: 'You will think about it tomorrow',
    genres: [9648, 878],
    sortBy: 'vote_average.desc',
    voteAverageGte: 7,
  },
  {
    id: 'laugh',
    label: 'Make me laugh',
    emoji: '😂',
    blurb: 'Zero stakes, all jokes',
    genres: [35],
    sortBy: 'vote_average.desc',
    voteAverageGte: 7,
  },
  {
    id: 'cry',
    label: 'Emotional damage',
    emoji: '😭',
    blurb: 'Crying is the point',
    genres: [18, 10749],
    sortBy: 'vote_average.desc',
    voteAverageGte: 7.5,
  },
  {
    id: 'scare',
    label: 'Scare me',
    emoji: '👻',
    blurb: 'Lights off, volume up',
    genres: [27, 9648],
    sortBy: 'popularity.desc',
    voteAverageGte: 6,
  },
  {
    id: 'truestory',
    label: 'True story',
    emoji: '📜',
    blurb: 'It actually happened',
    genres: [36, 99],
    sortBy: 'vote_average.desc',
    voteAverageGte: 7,
  },
  {
    id: 'escape',
    label: 'Escape reality',
    emoji: '🐉',
    blurb: 'Other worlds, bigger stakes',
    genres: [14, 12, 878],
    sortBy: 'popularity.desc',
    voteAverageGte: 6.5,
  },
]

/** The discover filter set a mood compiles to. */
export const moodToFilters = (mood: Mood) => ({
  with_genres: mood.genres.join('|'),
  sort_by: mood.sortBy,
  'vote_average.gte': mood.voteAverageGte,
  'vote_count.gte': 300,
})

export const moodById = (id: string | null): Mood | undefined =>
  MOODS.find((mood) => mood.id === id)
