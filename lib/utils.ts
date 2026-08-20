import { ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

import { MovieGenre } from '@/types/movie-genre'
import { ItemType } from '@/types/movie-result'
import { Season } from '@/types/series-details'
import { MOVIES_GENRE, TV_GENRE } from '@/lib/genres'
import { apiConfig } from '@/lib/tmdbConfig'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

function getImageURL(path: string) {
  return `${apiConfig.originalImage(path)}`
}

function getPosterImageURL(path: string) {
  return `${apiConfig.w500Image(path)}`
}

// Title logos (the hero's stylised wordmark) paint at max 64px tall on mobile
// and 128px on desktop. Requesting them through getImageURL meant `original` at
// w-2560 — 216 KB of transparent PNG for a 64px element, which over mobile data
// lost the race against the hero's fallback timer and left the plain text title
// on screen. w500 is the same image at 29.6 KB.
//
// Its own builder rather than w500Image: this is a plain <img>, so it never
// passes through next/image's loader and would otherwise keep the URL's default
// q-82 forever — see apiConfig.logoImage for why quality and not width.
function getLogoImageURL(path: string) {
  return `${apiConfig.logoImage(path)}`
}

// The wordmark is a plain <img> (next/image's loader never sees it — see
// apiConfig.logoImage), so the density ladder has to be written by hand. The
// element lays out at the file's intrinsic ~500 CSS px, which a retina screen
// paints at 1000 device px; without this the browser had one 500px file for
// both cases and simply stretched it.
function getLogoImageSrcSet(path: string) {
  return `${apiConfig.logoImage(path, 500)} 1x, ${apiConfig.logoImage(path, 1000)} 2x`
}

// Both search-result thumbs paint in the same 96x54 box, and both are rendered
// `unoptimized` (a fixed-size <img> with no srcset), so the file has to cover
// the densest screen on its own: 96 CSS px at dpr 3 is 288. w185 could not —
// it was the one thumb on the site being upscaled — and w300 can, for a few KB.
function getThumbPosterURL(path: string) {
  return `${apiConfig.w300Image(path)}`
}

function getThumbBackdropURL(path: string) {
  return `${apiConfig.w300Image(path)}`
}

function dateFormatter(date: string, showDay: boolean = false) {
  if (!date) return 'N/A'
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: showDay ? 'numeric' : undefined,
    // Pin to UTC so the server (UTC runtime) and the client (visitor's local
    // zone) render the SAME text. TMDB dates are calendar dates with no time
    // component; without this, a date like "2026-07-01" renders "July 2026" on
    // the server but "June 2026" for negative-offset (e.g. US) visitors, whose
    // local clock rolls it back a day across the month boundary — a text-content
    // hydration mismatch (React #418). See HeroRatesInfos / Card date display.
    timeZone: 'UTC',
  })
}

function numberRounder(number: number | undefined) {
  if (number) return Math.round(number * 10) / 10
}

// Pick singular/plural for a count. Defaults the plural to `${singular}s`; pass
// an explicit plural for irregular nouns. Returns the WORD only (no count), so
// callers control the surrounding text.
function pluralize(count: number, singular: string, plural?: string) {
  return count === 1 ? singular : (plural ?? `${singular}s`)
}

const RECENTLY_RELEASED_DAYS = 30

/**
 * Whether a release/air date falls within the last `withinDays` (and is not in
 * the future). Used to flag freshly released movies and series seasons as "new".
 */
function isRecentlyReleased(
  date?: string,
  withinDays: number = RECENTLY_RELEASED_DAYS
) {
  if (!date) return false
  const released = new Date(date)
  if (Number.isNaN(released.getTime())) return false

  const diffMs = Date.now() - released.getTime()
  if (diffMs < 0) return false // not released yet

  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  return diffDays <= withinDays
}

// Movies and TV use DIFFERENT TMDB genre-id tables (e.g. 10759 "Action &
// Adventure", 10765 "Sci-Fi & Fantasy", 10768 "War & Politics" are TV-only and
// don't exist for movies). Mapping raw `genre_ids` against the wrong table
// silently drops those genres, so the media type must pick the right table.
// Detail pages pass full `{id,name}` objects (defaultGenres) and skip this.
function getGenres(
  genres: number[] = [],
  defaultGenres: MovieGenre[] = [],
  mediaType: ItemType = 'movie',
  genreTable?: MovieGenre[]
) {
  if (defaultGenres.length) return defaultGenres
  // Prefer a live table passed by the caller (fetched from TMDB); otherwise
  // fall back to the bundled static list for the media type.
  const table = genreTable?.length
    ? genreTable
    : mediaType === 'tv'
      ? TV_GENRE
      : MOVIES_GENRE
  return table.filter((genre) => genres.includes(genre.id))
}

function itemRedirect(itemType: ItemType) {
  if (itemType === 'movie') {
    return '/movies'
  }
  return '/tv-shows'
}

function moneyFormatter(money: number) {
  if (!money) return 'N/A'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(money)
}

function convertMinutesToHours(minutes: number): string {
  if (!minutes) return 'N/A'

  const hours = Math.floor(minutes / 60)
  const min = minutes % 60

  let hoursString = hours > 0 ? `${hours} ${pluralize(hours, 'hour')}` : ''
  let minString = min > 0 ? `${min} ${pluralize(min, 'minute')}` : ''

  return `${hoursString} ${minString}`
}

function seasonsFormatter(seasons: Season[]) {
  return seasons.map((season) => {
    if (season.season_number === 0) return null
    return {
      id: season.id,
      name: season.name,
      poster_path: season.poster_path,
      season_number: season.season_number,
      air_date: season.air_date,
    }
  })
}

/**
 * A list of names as a sentence reads it: "Max", "Max and Hulu",
 * "Max, Hulu and Netflix".
 *
 * Two callers already needed this — the "now streaming" push notification and
 * the crawlable "where to watch" block — and a second hand-rolled join is how
 * the two start disagreeing about the Oxford comma in the same product.
 */
const listSentence = (names: string[]): string => {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

export {
  cn,
  listSentence,
  getImageURL,
  getLogoImageURL,
  getLogoImageSrcSet,
  getPosterImageURL,
  getThumbPosterURL,
  getThumbBackdropURL,
  dateFormatter,
  getGenres,
  numberRounder,
  pluralize,
  isRecentlyReleased,
  itemRedirect,
  moneyFormatter,
  convertMinutesToHours,
  seasonsFormatter,
}
