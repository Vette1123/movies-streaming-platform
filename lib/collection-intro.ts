/**
 * The visible intro on a collection page. The page used to carry the name,
 * TMDB's one-line overview and a poster grid, and GSC filed 24 of them as
 * crawled-not-indexed (2026-11-27). This states what the franchise holds, out
 * of the parts the page already renders: no extra TMDB request.
 */

export type IntroPart = {
  title: string
  release_date?: string
  vote_average?: number
  vote_count?: number
}

/** Below this many TMDB votes a rating is a handful of fans, not a verdict. */
const MIN_VOTES = 50

const yearOf = (p: IntroPart) => (p.release_date || '').slice(0, 4)

function countPhrase(n: number): string {
  return `${n} ${n === 1 ? 'movie' : 'movies'}`
}

function spanSentence(name: string, count: number, dated: IntroPart[]): string {
  const first = dated[0]
  const last = dated[dated.length - 1]
  if (count === 1)
    return `${name} holds 1 movie so far, ${first.title} (${yearOf(first)}).`
  if (dated.length === 1)
    return `${name} holds ${countPhrase(count)}, starting with ${first.title} (${yearOf(first)}).`
  const from = yearOf(first)
  const to = yearOf(last)
  const years = from === to ? `in ${from}` : `from ${from} to ${to}`
  return `${name} spans ${countPhrase(count)} released ${years}, from ${first.title} to ${last.title}.`
}

function bestRatedSentence(parts: IntroPart[]): string {
  const rated = parts.filter(
    (p) => (p.vote_count ?? 0) >= MIN_VOTES && p.vote_average
  )
  if (rated.length < 2) return ''
  const best = rated.reduce((a, b) =>
    (b.vote_average ?? 0) > (a.vote_average ?? 0) ? b : a
  )
  return `The best rated on TMDB is ${best.title} at ${(best.vote_average ?? 0).toFixed(1)}/10.`
}

function closingSentence(count: number, ordered: boolean): string {
  if (count === 1)
    return 'It is listed below with its rating, cast and where to watch it.'
  if (!ordered)
    return 'They are listed below, each with its rating, cast and where to watch it.'
  return 'They are listed below in release order, each with its rating, cast and where to watch it.'
}

export function collectionIntro(name: string, parts: IntroPart[]): string {
  if (!parts.length) return ''
  const dated = parts
    .filter((p) => /^\d{4}/.test(p.release_date || ''))
    .sort((a, b) => (a.release_date || '').localeCompare(b.release_date || ''))
  if (!dated.length)
    return `${name} holds ${countPhrase(parts.length)}. ${closingSentence(parts.length, false)}`
  return [
    spanSentence(name, parts.length, dated),
    bestRatedSentence(parts),
    closingSentence(parts.length, true),
  ]
    .filter(Boolean)
    .join(' ')
}
