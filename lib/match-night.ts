// Match Night's pure core: how a pile of swipes becomes matches. Kept free of
// D1 and fetch so it is unit-testable — the SQL groups likes per media, this
// module decides what the client does with them.

export interface SwipeRecord {
  swiper: string
  mediaId: number
  mediaType: 'movie' | 'tv'
  liked: boolean
}

export interface MatchedMedia {
  mediaId: number
  mediaType: 'movie' | 'tv'
  likers: string[]
}

/**
 * The identity of a card. NOT the TMDB id on its own: movie 1399 and series
 * 1399 are different titles, so an id-keyed set silently drops one of them
 * from the deck and can resolve a match to the wrong artwork.
 */
export const cardKey = (card: {
  id: number
  mediaType: 'movie' | 'tv'
}): string => `${card.mediaType}:${card.id}`

/**
 * The matches inside a swipe list: media liked by two or more DIFFERENT
 * people. A single super-user liking everything must not match themselves.
 */
export const resolveMatches = (swipes: SwipeRecord[]): MatchedMedia[] => {
  const likes = new Map<string, Set<string>>()
  const types = new Map<string, 'movie' | 'tv'>()

  for (const swipe of swipes) {
    if (!swipe.liked) continue
    const key = cardKey({ id: swipe.mediaId, mediaType: swipe.mediaType })
    const set = likes.get(key) ?? new Set<string>()
    set.add(swipe.swiper)
    likes.set(key, set)
    types.set(key, swipe.mediaType)
  }

  return [...likes.entries()]
    .filter(([, likers]) => likers.size >= 2)
    .map(([key, likers]) => ({
      mediaId: Number(key.split(':')[1]),
      mediaType: types.get(key) ?? 'movie',
      likers: [...likers],
    }))
}

/** The deck order: interleave movie and TV so neither hogs the swipe stack. */
export function interleave<T>(movies: T[], shows: T[]): T[] {
  const out: T[] = []
  const [a, b] = [...movies, ...shows].length ? [movies, shows] : [[], []]
  const max = Math.max(a.length, b.length)
  for (let i = 0; i < max; i++) {
    if (i < a.length) out.push(a[i])
    if (i < b.length) out.push(b[i])
  }
  return out
}

/**
 * The only fields the deck renders. TMDB hands the same title back in three
 * different shapes (popular movies, popular series, search/multi), so every
 * source is normalised here once rather than each caller re-deriving
 * title-vs-name and release_date-vs-first_air_date at the point of use.
 */
export interface MatchCard {
  id: number
  mediaType: 'movie' | 'tv'
  title: string
  poster: string | null
  year: string
  rating: number
}

interface RawMedia {
  id: number
  media_type?: string
  title?: string
  name?: string
  poster_path?: string | null
  release_date?: string
  first_air_date?: string
  vote_average?: number
}

/** Normalise one TMDB list/search row into a deck card. */
export const toMatchCard = (
  raw: RawMedia,
  fallbackType: 'movie' | 'tv'
): MatchCard => {
  const mediaType: 'movie' | 'tv' = (() => {
    if (raw.media_type === 'tv' || raw.media_type === 'movie') {
      return raw.media_type
    }
    // search/multi omits it on nothing, but popular lists omit it on
    // everything: a row with a name and no title is a series.
    if (!raw.title && raw.name) return 'tv'
    return fallbackType
  })()
  const date = raw.release_date ?? raw.first_air_date ?? ''
  return {
    id: raw.id,
    mediaType,
    title: raw.title ?? raw.name ?? 'Untitled',
    poster: raw.poster_path ?? null,
    year: date ? date.slice(0, 4) : '',
    rating: Math.round((raw.vote_average ?? 0) * 10) / 10,
  }
}

/** The detail page a card links to. */
export const matchCardHref = (card: MatchCard): string =>
  card.mediaType === 'tv' ? `/tv-shows/${card.id}` : `/movies/${card.id}`

/** First occurrence of each id wins, so an injected search hit is never
 * swiped twice because it also sits somewhere in the trending deck. */
export const dedupeCards = (cards: MatchCard[]): MatchCard[] => {
  const seen = new Set<string>()
  return cards.filter((card) => {
    const key = cardKey(card)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** A stable per-browser swiper identity — anonymous, no account involved. */
export const swiperIdentity = (): string => {
  const KEY = 'match-night-swiper'
  let id = localStorage.getItem(KEY)
  if (!id) {
    id = `s-${Math.random().toString(36).slice(2, 10)}`
    localStorage.setItem(KEY, id)
  }
  return id
}
