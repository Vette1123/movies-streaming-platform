const MOVIES_GENRE = [
  {
    id: 28,
    name: 'Action',
  },
  {
    id: 12,
    name: 'Adventure',
  },
  {
    id: 16,
    name: 'Animation',
  },
  {
    id: 35,
    name: 'Comedy',
  },
  {
    id: 80,
    name: 'Crime',
  },
  {
    id: 99,
    name: 'Documentary',
  },
  {
    id: 18,
    name: 'Drama',
  },
  {
    id: 10751,
    name: 'Family',
  },
  {
    id: 14,
    name: 'Fantasy',
  },
  {
    id: 36,
    name: 'History',
  },
  {
    id: 27,
    name: 'Horror',
  },
  {
    id: 10402,
    name: 'Music',
  },
  {
    id: 9648,
    name: 'Mystery',
  },
  {
    id: 10749,
    name: 'Romance',
  },
  {
    id: 878,
    name: 'Science Fiction',
  },
  {
    id: 10770,
    name: 'TV Movie',
  },
  {
    id: 53,
    name: 'Thriller',
  },
  {
    id: 10752,
    name: 'War',
  },
  {
    id: 37,
    name: 'Western',
  },
]

const TV_GENRE = [
  {
    id: 10759,
    name: 'Action & Adventure',
  },
  {
    id: 16,
    name: 'Animation',
  },
  {
    id: 35,
    name: 'Comedy',
  },
  {
    id: 80,
    name: 'Crime',
  },
  {
    id: 99,
    name: 'Documentary',
  },
  {
    id: 18,
    name: 'Drama',
  },
  {
    id: 10751,
    name: 'Family',
  },
  {
    id: 10762,
    name: 'Kids',
  },
  {
    id: 9648,
    name: 'Mystery',
  },
  {
    id: 10763,
    name: 'News',
  },
  {
    id: 10764,
    name: 'Reality',
  },
  {
    id: 10765,
    name: 'Sci-Fi & Fantasy',
  },
  {
    id: 10766,
    name: 'Soap',
  },
  {
    id: 10767,
    name: 'Talk',
  },
  {
    id: 10768,
    name: 'War & Politics',
  },
  {
    id: 37,
    name: 'Western',
  },
]

// URL-safe slug for a genre name, e.g. "Sci-Fi & Fantasy" → "sci-fi-and-fantasy".
const genreToSlug = (name: string): string =>
  name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

type GenreWithSlug = { id: number; name: string; slug: string }

const withSlug = (g: { id: number; name: string }): GenreWithSlug => ({
  ...g,
  slug: genreToSlug(g.name),
})

const MOVIE_GENRES_WITH_SLUG: GenreWithSlug[] = MOVIES_GENRE.map(withSlug)
const TV_GENRES_WITH_SLUG: GenreWithSlug[] = TV_GENRE.map(withSlug)

const findMovieGenreBySlug = (slug: string): GenreWithSlug | undefined =>
  MOVIE_GENRES_WITH_SLUG.find((g) => g.slug === slug)

const findTvGenreBySlug = (slug: string): GenreWithSlug | undefined =>
  TV_GENRES_WITH_SLUG.find((g) => g.slug === slug)

// Match a TMDB genre id to one that has a landing page. Detail payloads carry
// genre ids, so this lets us link only the genres we actually route for and
// leave any stray one as plain text (no dead link to a notFound() page).
const findMovieGenreById = (id: number): GenreWithSlug | undefined =>
  MOVIE_GENRES_WITH_SLUG.find((g) => g.id === id)

const findTvGenreById = (id: number): GenreWithSlug | undefined =>
  TV_GENRES_WITH_SLUG.find((g) => g.id === id)

export {
  MOVIES_GENRE,
  TV_GENRE,
  MOVIE_GENRES_WITH_SLUG,
  TV_GENRES_WITH_SLUG,
  genreToSlug,
  findMovieGenreBySlug,
  findTvGenreBySlug,
  findMovieGenreById,
  findTvGenreById,
  type GenreWithSlug,
}
