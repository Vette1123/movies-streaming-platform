// What a tail-id page says about a title, beyond its meta description.
//
// The Worker assembles detail pages for ids outside the prerendered set. Until
// now the only thing in that HTML for a crawler that runs no JS was an <h1> and
// the 158-character meta description — 1,393 visible characters against 2,405
// on a prerendered page, and the rest of the document is the same nav and
// footer on all ~13,900 of them. Google read that exactly as it looks: 112
// "Soft 404", 6,961 "Duplicate without user-selected canonical", 10,203
// "Crawled - currently not indexed".
//
// Everything below comes out of the SAME plain detail response the fallback
// already fetches (services/media-summary.ts) — no second TMDB request, no
// `append_to_response`, nothing added to the 10ms CPU budget beyond building a
// few strings. It was all sitting in the payload unread.

import type { MediaSummary } from '@/services/media-summary'

import {
  findMovieGenreById,
  findTvGenreById,
  type GenreWithSlug,
} from '@/lib/genres'
import { FIRST_YEAR } from '@/lib/year-range'

export interface SeoFact {
  label: string
  value: string
}

export interface SeoLink {
  href: string
  text: string
}

export interface MediaFacts {
  /** A sentence assembled from the facts, so no two titles read alike. */
  intro: string
  /** The FULL synopsis, not the description's 158-character cut. */
  overview: string
  tagline: string
  facts: SeoFact[]
  /** Genre, year and franchise hubs — real crawl paths off a tail page. */
  links: SeoLink[]
  /** For JSON-LD: only present when TMDB has votes to report. */
  rating: { value: number; count: number } | null
  /** ISO 8601, for JSON-LD `duration`. Empty when TMDB has no runtime. */
  duration: string
  /** YYYY-MM-DD, for JSON-LD `datePublished`. */
  released: string
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const squash = (value?: string | null) =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()

/** "2024-03-15" → "15 March 2024". Anything else comes back as given. */
const longDate = (date?: string | null): string => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date ?? ''))
  if (!match) return ''
  const month = MONTHS[Number(match[2]) - 1]
  if (!month) return ''
  return `${Number(match[3])} ${month} ${match[1]}`
}

const yearOf = (date?: string | null) => String(date ?? '').slice(0, 4)

/** 123 → "2h 3m", 47 → "47m". */
const runtimeText = (minutes?: number | null): string => {
  const total = Number(minutes)
  if (!Number.isFinite(total) || total <= 0) return ''
  const hours = Math.floor(total / 60)
  const rest = total % 60
  if (!hours) return `${rest}m`
  return rest ? `${hours}h ${rest}m` : `${hours}h`
}

/** ISO 8601 duration, the only shape schema.org accepts for `duration`. */
const isoDuration = (minutes?: number | null): string => {
  const total = Number(minutes)
  if (!Number.isFinite(total) || total <= 0) return ''
  const hours = Math.floor(total / 60)
  const rest = total % 60
  return `PT${hours ? `${hours}H` : ''}${rest ? `${rest}M` : ''}`
}

/**
 * The spoken name of the original language ("ja" → "Japanese").
 *
 * TMDB ships the mapping inside the same payload — `spoken_languages` carries
 * an `english_name` for each — so there is no table to keep here. A title whose
 * original language is not among the spoken ones falls back to the raw code.
 */
const languageName = (details: MediaSummary): string => {
  const code = details.original_language
  if (!code) return ''
  const match = details.spoken_languages?.find(
    (language) => language.iso_639_1 === code
  )
  return match?.english_name || code.toUpperCase()
}

const names = (list?: { name: string }[], limit = 3) =>
  (list ?? [])
    .slice(0, limit)
    .map((entry) => entry.name)
    .filter(Boolean)

/** A list read aloud: "A, B and C". */
const readable = (parts: string[]) => {
  if (parts.length < 2) return parts[0] ?? ''
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

/** 'an English series', 'a Japanese movie'. Good enough for the five vowels. */
const article = (phrase: string) => (/^[aeiou]/i.test(phrase) ? 'an' : 'a')

const push = (facts: SeoFact[], label: string, value: string) => {
  if (value) facts.push({ label, value })
}

const genreLinks = (type: 'movie' | 'tv', details: MediaSummary): SeoLink[] => {
  const base = type === 'tv' ? '/tv-shows' : '/movies'
  const find = type === 'tv' ? findTvGenreById : findMovieGenreById
  return (details.genres ?? [])
    .map((genre) => find(genre.id))
    .filter((genre): genre is GenreWithSlug => Boolean(genre))
    .map((genre) => ({
      href: `${base}/genre/${genre.slug}`,
      text: `${genre.name} ${type === 'tv' ? 'series' : 'movies'}`,
    }))
}

/**
 * The year hub, but only for a year that HAS one — the route is prebuilt from
 * 1990 to now and `dynamicParams` is false, so linking 1974 would be linking a
 * 404 out of every page that mentions it.
 */
const yearLink = (type: 'movie' | 'tv', year: string): SeoLink | null => {
  const value = Number(year)
  if (!/^\d{4}$/.test(year)) return null
  if (value < FIRST_YEAR || value > new Date().getFullYear()) return null
  const base = type === 'tv' ? '/tv-shows' : '/movies'
  const label = type === 'tv' ? 'series' : 'movies'
  return { href: `${base}/year/${year}`, text: `The best ${label} of ${year}` }
}

const movieIntro = (
  title: string,
  details: MediaSummary,
  genres: string[]
): string => {
  const language = languageName(details)
  const kind = [language, readable(genres).toLowerCase(), 'movie']
    .filter(Boolean)
    .join(' ')
  const date = longDate(details.release_date)
  const when = date ? ` released on ${date}` : ''
  const runtime = runtimeText(details.runtime)
  const long = runtime ? `, running ${runtime}` : ''
  return `${title} is ${article(kind)} ${kind}${when}${long}.`
}

/** "ran from 2011 to 2019" / "has been running since 2022". */
const airedSpan = (details: MediaSummary): string => {
  const from = yearOf(details.first_air_date)
  const to = yearOf(details.last_air_date)
  if (!from) return ''
  if (details.in_production || !to) return ` first aired in ${from}`
  return from === to ? ` aired in ${from}` : ` that ran from ${from} to ${to}`
}

const seasonSpan = (details: MediaSummary): string => {
  const seasons = Number(details.number_of_seasons) || 0
  const episodes = Number(details.number_of_episodes) || 0
  if (!seasons && !episodes) return ''
  const parts = [
    seasons ? `${seasons} season${seasons === 1 ? '' : 's'}` : '',
    episodes ? `${episodes} episode${episodes === 1 ? '' : 's'}` : '',
  ].filter(Boolean)
  return `, across ${readable(parts)}`
}

const tvIntro = (
  title: string,
  details: MediaSummary,
  genres: string[]
): string => {
  const language = languageName(details)
  const kind = [language, readable(genres).toLowerCase(), 'series']
    .filter(Boolean)
    .join(' ')
  const network = names(details.networks, 1)[0]
  const where = network ? `, on ${network}` : ''
  return `${title} is ${article(kind)} ${kind}${airedSpan(details)}${seasonSpan(details)}${where}.`
}

const introOf = (
  type: 'movie' | 'tv',
  title: string,
  details: MediaSummary,
  genres: string[]
) =>
  type === 'tv'
    ? tvIntro(title, details, genres)
    : movieIntro(title, details, genres)

const movieFacts = (details: MediaSummary, facts: SeoFact[]) => {
  push(facts, 'Released', longDate(details.release_date))
  push(facts, 'Runtime', runtimeText(details.runtime))
  push(facts, 'Studio', readable(names(details.production_companies)))
}

const tvFacts = (details: MediaSummary, facts: SeoFact[]) => {
  push(facts, 'First aired', longDate(details.first_air_date))
  push(facts, 'Last aired', longDate(details.last_air_date))
  const seasons = Number(details.number_of_seasons) || 0
  const episodes = Number(details.number_of_episodes) || 0
  push(facts, 'Seasons', seasons ? String(seasons) : '')
  push(facts, 'Episodes', episodes ? String(episodes) : '')
  push(facts, 'Network', readable(names(details.networks, 2)))
  push(facts, 'Created by', readable(names(details.created_by, 3)))
}

/**
 * Everything a tail page can say about a title using only the payload it has
 * already paid for.
 */
export function mediaFacts(
  type: 'movie' | 'tv',
  details: MediaSummary
): MediaFacts {
  const title = details.title || details.name || 'Untitled'
  const genres = names(details.genres, 3)
  const votes = Number(details.vote_count) || 0
  const score = Number(details.vote_average) || 0

  const facts: SeoFact[] = []
  if (type === 'tv') tvFacts(details, facts)
  else movieFacts(details, facts)
  push(facts, 'Genres', genres.join(', '))
  push(facts, 'Language', languageName(details))
  push(facts, 'Country', readable(names(details.production_countries, 2)))
  push(facts, 'Status', squash(details.status))
  push(
    facts,
    'Rating',
    votes > 0 ? `${score.toFixed(1)}/10 from ${votes} TMDB votes` : ''
  )
  const original = squash(details.original_title || details.original_name)
  push(facts, 'Original title', original && original !== title ? original : '')

  const links = genreLinks(type, details)
  const year = yearLink(
    type,
    yearOf(details.release_date || details.first_air_date)
  )
  if (year) links.push(year)
  if (details.belongs_to_collection?.id) {
    links.push({
      href: `/collection/${details.belongs_to_collection.id}`,
      text: details.belongs_to_collection.name || 'The full collection',
    })
  }

  const runtime =
    type === 'tv' ? details.episode_run_time?.[0] : details.runtime

  return {
    intro: introOf(type, title, details, genres),
    overview: squash(details.overview),
    tagline: squash(details.tagline),
    facts,
    links,
    rating: votes > 0 ? { value: score, count: votes } : null,
    duration: isoDuration(runtime),
    released: squash(details.release_date || details.first_air_date),
  }
}
