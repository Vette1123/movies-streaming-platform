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
 * The matches inside a swipe list: media liked by two or more DIFFERENT
 * people. A single super-user liking everything must not match themselves.
 */
export const resolveMatches = (swipes: SwipeRecord[]): MatchedMedia[] => {
  const likes = new Map<string, Set<string>>()
  const types = new Map<string, 'movie' | 'tv'>()

  for (const swipe of swipes) {
    if (!swipe.liked) continue
    const key = `${swipe.mediaType}:${swipe.mediaId}`
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
