'use server'

import { FilterParams } from '@/types/filter'
import { MediaResponse } from '@/types/media'
import { Param } from '@/types/movie-result'
import { fetchClient } from '@/lib/fetch-client'

// Discover movies with filters
const discoverMovies = async (
  filterParams: FilterParams = {},
  params: Param = {}
): Promise<MediaResponse> => {
  const url = 'discover/movie'

  // Convert FilterParams to Record<string, string | number>
  const convertedParams: Record<string, string | number> = {}
  Object.entries(filterParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (typeof value === 'boolean') {
        convertedParams[key] = value.toString()
      } else {
        convertedParams[key] = value
      }
    }
  })

  const queryParams = {
    language: 'en-US',
    include_adult: 'false',
    include_video: 'false',
    page: 1,
    ...convertedParams,
    ...params,
  }

  return fetchClient.get<MediaResponse>(url, queryParams, true)
}

// Discover TV series with filters
const discoverSeries = async (
  filterParams: FilterParams = {},
  params: Param = {}
): Promise<MediaResponse> => {
  const url = 'discover/tv'

  // Convert FilterParams to Record<string, string | number>
  const convertedParams: Record<string, string | number> = {}
  Object.entries(filterParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (typeof value === 'boolean') {
        convertedParams[key] = value.toString()
      } else {
        convertedParams[key] = value
      }
    }
  })

  // Map movie-specific params to TV-specific params
  if (convertedParams['release_date.gte']) {
    convertedParams['first_air_date.gte'] = convertedParams['release_date.gte']
    delete convertedParams['release_date.gte']
  }
  if (convertedParams['release_date.lte']) {
    convertedParams['first_air_date.lte'] = convertedParams['release_date.lte']
    delete convertedParams['release_date.lte']
  }

  const queryParams: Record<string, string | number> = {
    language: 'en-US',
    include_adult: 'false',
    page: 1,
    ...convertedParams,
    ...params,
  }

  return fetchClient.get<MediaResponse>(url, queryParams, true)
}

// Get movie genres
const getMovieGenres = async () => {
  const url = 'genre/movie/list'
  return fetchClient.get<{ genres: { id: number; name: string }[] }>(
    url,
    { language: 'en-US' },
    true
  )
}

// Get TV genres
const getTVGenres = async () => {
  const url = 'genre/tv/list'
  return fetchClient.get<{ genres: { id: number; name: string }[] }>(
    url,
    { language: 'en-US' },
    true
  )
}

// Get available languages
const getLanguages = async () => {
  const url = 'configuration/languages'
  return fetchClient.get<
    { iso_639_1: string; english_name: string; name: string }[]
  >(url, {}, true)
}

// Get available countries
const getCountries = async () => {
  const url = 'configuration/countries'
  return fetchClient.get<{ iso_3166_1: string; english_name: string }[]>(
    url,
    {},
    true
  )
}

export {
  discoverMovies,
  discoverSeries,
  getMovieGenres,
  getTVGenres,
  getLanguages,
  getCountries,
}
