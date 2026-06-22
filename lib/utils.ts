import { ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

import { MovieGenre } from '@/types/movie-genre'
import { ItemType } from '@/types/movie-result'
import { Season } from '@/types/series-details'
import { MOVIES_GENRE } from '@/lib/genres'
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

function getThumbPosterURL(path: string) {
  return `${apiConfig.w185Image(path)}`
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
  })
}

function numberRounder(number: number | undefined) {
  if (number) return Math.round(number * 10) / 10
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

function getGenres(genres: number[] = [], defaultGenres: MovieGenre[] = []) {
  if (defaultGenres.length) return defaultGenres
  return MOVIES_GENRE.filter((genre) => genres.includes(genre.id))
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

  let hoursString = hours > 0 ? `${hours} hour${hours > 1 ? 's' : ''}` : ''
  let minString = min > 0 ? `${min} minute${min > 1 ? 's' : ''}` : ''

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

function formatDate(
  date: Date,
  format: 'short' | 'long' | 'medium' = 'medium'
): string {
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month:
      format === 'short' ? '2-digit' : format === 'long' ? 'long' : 'short',
    day: '2-digit',
  }

  return date.toLocaleDateString('en-US', options)
}

export {
  cn,
  getImageURL,
  getPosterImageURL,
  getThumbPosterURL,
  getThumbBackdropURL,
  dateFormatter,
  getGenres,
  numberRounder,
  isRecentlyReleased,
  itemRedirect,
  moneyFormatter,
  convertMinutesToHours,
  seasonsFormatter,
  formatDate,
}
