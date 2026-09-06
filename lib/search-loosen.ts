/**
 * Rescuing a search that found nothing.
 *
 * TMDB's `search/multi` matches PREFIXES and does no fuzzy matching at all, so
 * one wrong letter is a dead end rather than a near miss. Measured on the live
 * site over five days, 13% of searches returned nothing, and almost all of them
 * were one of two shapes:
 *
 *   - a typo late in a word — `godfathr`, `spidermn`, `avatr`, `conjut`,
 *     `possesion`. Every one of these is rescued by dropping characters off the
 *     end until the prefix is right again: `godfath`, `spiderm`, `avat`,
 *     `conju`, `posses` all return the intended title as the first result.
 *   - a misspelt word in a phrase — `shawshank redemtion`, `Ride lr die`. The
 *     other words are spelt correctly, so the phrase is rescued by dropping the
 *     broken word rather than by editing it.
 *
 * So the variants below are ordered by how often they paid off in that data,
 * and the caller stops at the first one that returns anything. Four of the five
 * single-word typos above are recovered by the FIRST variant, which is why this
 * is worth at most a few hundred milliseconds on a query that was otherwise
 * going to show an empty list.
 *
 * Deliberately not a spellchecker. There is no dictionary of film titles to
 * check against, a real one would have to ship to the client or cost another
 * round trip, and prefix truncation gets the same answer for the cases that
 * actually occur.
 */

/** Below this a prefix matches everything and the results are noise. */
const MIN_PREFIX = 4

/** How many extra round trips a failed search may cost. */
export const MAX_LOOSENING_ATTEMPTS = 3

/**
 * Somebody pasted a link instead of typing a title.
 *
 * 29% of the zero-result searches were YouTube and Instagram URLs — people
 * watching a clip and hoping the address of it would find the film. Searching
 * TMDB for that string is a guaranteed miss, so it is worth recognising before
 * spending the request, and worth answering with something other than the
 * silence it gets today.
 */
export function looksLikeUrl(query: string): boolean {
  return /^(https?:\/\/|www\.)\S+$/i.test(query.trim())
}

const words = (query: string): string[] =>
  query.trim().split(/\s+/).filter(Boolean)

/** The longest word, which in a mistyped phrase is usually the broken one. */
function longestWord(list: string[]): string {
  return list.reduce((best, w) => (w.length > best.length ? w : best), '')
}

/** Replace one word in place, so the rest of the phrase still constrains it. */
function withWordTruncated(
  list: string[],
  word: string,
  by: number
): string | null {
  const cut = word.length - by
  if (cut < MIN_PREFIX) return null
  return list.map((w) => (w === word ? w.slice(0, cut) : w)).join(' ')
}

/**
 * Progressively looser versions of a query, best-first.
 *
 * Never returns the original, never returns duplicates, and never returns
 * something shorter than `MIN_PREFIX`. An empty array means there is nothing
 * sensible left to try, which is a genuine no-results answer.
 */
export function looseningVariants(query: string): string[] {
  const trimmed = query.trim()
  if (!trimmed || looksLikeUrl(trimmed)) return []

  const list = words(trimmed)
  const longest = longestWord(list)
  const out: string[] = []
  const push = (candidate: string | null) => {
    if (!candidate) return
    const value = candidate.trim()
    if (!value || value === trimmed || value.length < MIN_PREFIX) return
    if (!out.includes(value)) out.push(value)
  }

  if (list.length > 1) {
    // The whole phrase minus its last word: `shawshank redemtion` ->
    // `shawshank`, which finds The Shawshank Redemption first.
    push(list.slice(0, -1).join(' '))
    // And the longest word alone, for a phrase whose NOISE is at the end:
    // `Ride lr die` -> `Ride`, which finds Ride or Die first.
    push(longest)
  }

  // Then walk the prefix back a character at a time. One step recovers four of
  // the five single-word typos that were measured; three covers the rest.
  for (let by = 1; by <= 3; by++) push(withWordTruncated(list, longest, by))

  return out
}
