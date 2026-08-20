import { describe, expect, it } from 'vitest'

import {
  parseFilterQuery,
  smartQuery,
  toDiscoverParams,
} from '@/lib/filter-query'

/**
 * A smart list stores a browse query and resolves it months later, in a
 * different runtime, against a TMDB endpoint whose parameter names differ by
 * media type. Every one of those steps fails quietly — the list simply shows
 * the wrong films — so the mapping is pinned here rather than eyeballed.
 */
describe('parseFilterQuery', () => {
  it('reads a missing key as its default, because that is what the URL means', () => {
    // `clearOnDefault` keeps a defaulted filter OUT of the URL, so an empty
    // query is "no filters", not "every number is zero".
    const filter = parseFilterQuery('')
    expect(filter.sortBy).toBe('popularity.desc')
    expect(filter.maxRating).toBe(10)
    expect(filter.maxRuntime).toBe(300)
    expect(filter.selectedGenres).toEqual([])
  })

  it('parses comma-separated ids the way nuqs writes them', () => {
    expect(parseFilterQuery('selectedGenres=27,53').selectedGenres).toEqual([
      27, 53,
    ])
    expect(parseFilterQuery('watchProviders=8,9').watchProviders).toEqual([
      8, 9,
    ])
  })

  it('survives a leading question mark and rubbish it does not know', () => {
    const filter = parseFilterQuery('?minRating=7&somethingElse=x')
    expect(filter.minRating).toBe(7)
  })

  it('falls back rather than producing NaN', () => {
    expect(parseFilterQuery('minRating=abc').minRating).toBe(0)
    expect(parseFilterQuery('selectedGenres=27,abc').selectedGenres).toEqual([
      27,
    ])
  })
})

describe('toDiscoverParams', () => {
  const base = parseFilterQuery('')

  it('leaves out everything sitting at its default', () => {
    // A parameter TMDB reads as "no constraint" still widens the cache key it
    // is sent with.
    expect(toDiscoverParams(base, 'movie')).toEqual({
      sort_by: 'popularity.desc',
    })
  })

  it('uses the date parameter the endpoint actually has', () => {
    const filter = parseFilterQuery('fromDate=2020-01-01&toDate=2029-12-31')
    expect(toDiscoverParams(filter, 'movie')).toMatchObject({
      'release_date.gte': '2020-01-01',
      'release_date.lte': '2029-12-31',
    })
    expect(toDiscoverParams(filter, 'tv')).toMatchObject({
      'first_air_date.gte': '2020-01-01',
      'first_air_date.lte': '2029-12-31',
    })
  })

  it('drops the two filters TV discover does not have', () => {
    const filter = parseFilterQuery(
      'minRuntime=90&maxRuntime=150&certification=R'
    )
    const tv = toDiscoverParams(filter, 'tv')
    expect(tv.with_runtime_gte).toBeUndefined()
    expect(tv.certification).toBeUndefined()

    const movie = toDiscoverParams(filter, 'movie')
    expect(movie.with_runtime_gte).toBe(90)
    expect(movie.with_runtime_lte).toBe(150)
    expect(movie.certification).toBe('R')
    // Certification means nothing to TMDB without the country it belongs to.
    expect(movie.certification_country).toBeTruthy()
  })

  it('ORs watch providers and sends the region with them', () => {
    const params = toDiscoverParams(
      parseFilterQuery('watchProviders=8,9&watchRegion=GB'),
      'movie'
    )
    expect(params.with_watch_providers).toBe('8|9')
    expect(params.watch_region).toBe('GB')
  })
})

describe('smartQuery', () => {
  it('takes the media type from the query, since a list has no page', () => {
    expect(smartQuery('selectedGenres=27&mediaType=tv').mediaType).toBe('tv')
    expect(smartQuery('selectedGenres=27').mediaType).toBe('movie')
  })

  it('resolves the filters against that media type', () => {
    const { params } = smartQuery('fromDate=2020-01-01&mediaType=tv')
    expect(params['first_air_date.gte']).toBe('2020-01-01')
    expect(params['release_date.gte']).toBeUndefined()
  })
})
