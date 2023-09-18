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
    }
  })
}

export {
  cn,
  getImageURL,
  getPosterImageURL,
  dateFormatter,
  getGenres,
  numberRounder,
  itemRedirect,
  moneyFormatter,
  convertMinutesToHours,
  seasonsFormatter,
}
