/**
 * The visible intro on a genre landing page. A single templated line ("Popular
 * drama movies, refreshed regularly.") made 35 genre pages read alike, and GSC
 * filed four of them as crawled-not-indexed. This names what the page actually
 * lists, from the same build-time discover payload the grid renders, so every
 * genre reads differently and the text refreshes with each deploy.
 */

const TOP = 3
const COUNT_CAP = 10_000

function joinNames(names: string[]): string {
  if (names.length < 2) return names.join('')
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

function singularOf(plural: string): string {
  return plural.replace(/s$/, '')
}

function leadSentence(genre: string, plural: string, top: string[]): string {
  if (top.length === 1) {
    return `The most popular ${genre} ${singularOf(plural)} on Reely right now is ${top[0]}.`
  }
  return `The most popular ${genre} ${plural} on Reely right now are ${joinNames(top)}.`
}

function browseSentence(genre: string, plural: string, total?: number): string {
  if (total === 1) {
    return 'Browse it by popularity, with its rating, cast and where to watch it.'
  }
  if (!total)
    return `Browse ${genre} ${plural} by popularity, each with its rating, cast and where to watch it.`
  // TMDB's discover caps total_results (20,001 for drama AND animation, 2026-11-26)
  // and stops at 500 pages, so a big count is neither true nor browsable.
  if (total >= COUNT_CAP)
    return `Browse thousands of ${genre} ${plural} by popularity, each with its rating, cast and where to watch it.`
  return `Browse the most popular of TMDB's ${total.toLocaleString('en-US')} ${genre} ${plural}, each with its rating, cast and where to watch it.`
}

export function genreIntro(
  genreName: string,
  bodyPlural: string,
  titles: string[],
  total?: number
): string {
  const genre = genreName.toLowerCase()
  const top = titles.slice(0, TOP)
  if (top.length === 0)
    return `Popular ${genre} ${bodyPlural}, refreshed regularly.`
  return `${leadSentence(genre, bodyPlural, top)} ${browseSentence(genre, bodyPlural, total)}`
}
