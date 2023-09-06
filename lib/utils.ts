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

function dateFormatter(date: string) {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
  })
}

function getThreeMoviesGenres(genres: number[]) {
  // const threeGenres = genres.slice(0, 3)
  const threeGenres = genres
  return MOVIES_GENRE.filter((genre) => threeGenres.includes(genre.id))
}

export {
  cn,
  getImageURL,
  getPosterImageURL,
  dateFormatter,
  getThreeMoviesGenres,
}
