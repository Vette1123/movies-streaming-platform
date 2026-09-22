/**
 * How much two public profiles overlap, computed where the profiles already are.
 *
 * Both sides arrive as `/api/profile/<handle>` responses — the same payload the
 * profile shell draws — so a compare is two client fetches and this file. No
 * new endpoint, no D1 join, no Worker route: the only question is set overlap
 * over each person's rated-highest titles.
 *
 * Keys are `type:id`, never the bare TMDB id: movie 603 and series 603 are
 * different titles, and treating them as one is how a compare invents a match.
 *
 * `PublicProfile.topRated` carries no `genre_ids` (the reviews payload never
 * had them), so this is title overlap, not genre overlap — a genre score would
 * need one TMDB lookup per row on both sides, which is exactly the subrequest
 * pattern the free plan already banned elsewhere.
 */

import { normaliseHandle, type ProfileTitle } from '@/lib/profile/routes'

/**
 * A handle out of whatever somebody typed or pasted: `gado`, `@Gado`, or the
 * profile link itself (`https://reely.space/u/gado?x=1`). Null when what is
 * left is not a valid handle — the same rule the profile editor enforces.
 */
export function handleFromInput(raw: string): string | null {
  const bare = raw
    .trim()
    .replace(/^.*\/u\//, '')
    .replace(/[/?#].*$/, '')
    .replace(/^@/, '')
  return normaliseHandle(bare)
}

export interface TasteMatch {
  /** In both rated-highest lists, in A's order. */
  shared: ProfileTitle[]
  /** Only in A's rated-highest list, in A's order. */
  onlyA: ProfileTitle[]
  /** Only in B's rated-highest list, in B's order. */
  onlyB: ProfileTitle[]
  /**
   * Jaccard overlap × 100, rounded. 0 when the union is empty (neither person
   * has rated anything) — not 100, which would read as perfect taste alignment
   * between two empty shelves.
   */
  score: number
}

const titleKey = (title: ProfileTitle): string => `${title.type}:${title.id}`

export function matchTopRated(
  a: ProfileTitle[],
  b: ProfileTitle[]
): TasteMatch {
  const inB = new Set(b.map(titleKey))
  const inA = new Set(a.map(titleKey))

  const shared: ProfileTitle[] = []
  const onlyA: ProfileTitle[] = []
  for (const title of a) {
    if (inB.has(titleKey(title))) shared.push(title)
    else onlyA.push(title)
  }

  const onlyB = b.filter((title) => !inA.has(titleKey(title)))

  const union = shared.length + onlyA.length + onlyB.length
  const score = union === 0 ? 0 : Math.round((shared.length / union) * 100)

  return { shared, onlyA, onlyB, score }
}

/** The line under the score. Names the count, never promises a personality. */
export function matchBlurb(match: TasteMatch): string {
  const n = match.shared.length
  if (n === 0) return 'No titles in both rated-highest lists.'
  if (n === 1) return 'One title in both rated-highest lists.'
  return `${n} titles in both rated-highest lists.`
}
