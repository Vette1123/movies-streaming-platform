import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

import { ItemType, Movie } from '@/types/movie-result'
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

function getGenres(genres: number[]) {
  // const threeGenres = genres.slice(0, 3)
  return MOVIES_GENRE.filter((genre) => genres.includes(genre.id))
}

function itemRedirect(itemType: ItemType) {
  if (itemType === 'movie') {
    return '/movies'
  }
  return '/series'
}

export {
  cn,
  getImageURL,
  getPosterImageURL,
  dateFormatter,
  getGenres,
  numberRounder,
  itemRedirect,
}
