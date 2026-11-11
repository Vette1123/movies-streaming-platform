import { describe, expect, it } from 'vitest'

import { jsonLdText } from '@/lib/json-ld'
import {
  movieJsonLd,
  movieTrailerJsonLd,
  seriesTrailerJsonLd,
  tvSeriesJsonLd,
} from '@/lib/structured-data'

const movie = {
  id: 550,
  title: 'Fight Club',
  releaseDate: '1999-10-15',
  genres: ['Drama'],
  description: 'An insomniac office worker starts a fight club.',
  trailerKey: 'SUXWAEX2jlg',
  trailerPublishedAt: '2014-01-02T10:00:00.000Z',
}

describe('trailer VideoObject', () => {
  it('has every field Google requires, as a standalone node', () => {
    const video = movieTrailerJsonLd(movie)!
    expect(video['@context']).toBe('https://schema.org')
    expect(video['@type']).toBe('VideoObject')
    expect(video['@id']).toBe('https://www.reely.space/movies/550#trailer')
    expect(video.name).toBe('Fight Club — Official Trailer')
    expect(video.description.length).toBeGreaterThan(40)
    expect(video.thumbnailUrl).toBe(
      'https://i.ytimg.com/vi/SUXWAEX2jlg/hqdefault.jpg'
    )
    expect(video.uploadDate).toBe('2014-01-02T10:00:00.000Z')
    expect(video.embedUrl).toBe('https://www.youtube.com/embed/SUXWAEX2jlg')
  })

  it('is the same entity as the Movie trailer property', () => {
    const { '@context': _, ...standalone } = movieTrailerJsonLd(movie)!
    expect(movieJsonLd(movie).trailer).toEqual(standalone)
  })

  it('covers series too', () => {
    const input = {
      id: 1396,
      name: 'Breaking Bad',
      trailerKey: 'abc',
      trailerPublishedAt: '2013-01-01T00:00:00Z',
    }
    expect(seriesTrailerJsonLd(input)!['@id']).toContain('/tv-shows/1396#')
    expect(tvSeriesJsonLd(input).trailer).toBeDefined()
  })

  it('is omitted without a key or without a publish date', () => {
    expect(
      movieTrailerJsonLd({ ...movie, trailerKey: undefined })
    ).toBeUndefined()
    expect(
      movieTrailerJsonLd({ ...movie, trailerPublishedAt: undefined })
    ).toBeUndefined()
    expect(
      movieJsonLd({ ...movie, trailerPublishedAt: null }).trailer
    ).toBeUndefined()
  })

  it('stays escaped inside the script element', () => {
    const video = movieTrailerJsonLd({
      ...movie,
      title: '</script><img src=x onerror=alert(1)>',
    })
    expect(jsonLdText(video)).not.toMatch(/<\//)
  })
})
