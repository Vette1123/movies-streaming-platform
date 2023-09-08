import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

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
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: showDay ? 'numeric' : undefined,
  })
}

function numberRounder(number: number) {
  return Math.round(number * 10) / 10
}

function getThreeMoviesGenres(genres: number[]) {
  // const threeGenres = genres.slice(0, 3)
  return MOVIES_GENRE.filter((genre) => genres.includes(genre.id))
}

export {
  cn,
  getImageURL,
  getPosterImageURL,
  dateFormatter,
  getThreeMoviesGenres,
  numberRounder,
}
