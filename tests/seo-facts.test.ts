import type { MediaSummary } from '@/services/media-summary'
import { describe, expect, it } from 'vitest'

import { mediaFacts } from '@/lib/seo-facts'

const movie: MediaSummary = {
  id: 1157186,
  title: 'The Quiet Hour',
  original_title: 'Shizuka na Jikan',
  overview: 'A retired detective returns to the village that made him.',
  tagline: 'Some cases never close.',
  release_date: '2024-03-15',
  runtime: 123,
  status: 'Released',
  original_language: 'ja',
  spoken_languages: [{ iso_639_1: 'ja', english_name: 'Japanese' }],
  genres: [
    { id: 18, name: 'Drama' },
    { id: 53, name: 'Thriller' },
  ],
  production_companies: [{ id: 1, name: 'Toho' }],
  production_countries: [{ iso_3166_1: 'JP', name: 'Japan' }],
  vote_average: 7.25,
  vote_count: 48,
  belongs_to_collection: { id: 999, name: 'The Quiet Collection' },
}

const series: MediaSummary = {
  id: 1399,
  name: 'Game of Thrones',
  overview: 'Seven noble families fight for control of the mythical land.',
  first_air_date: '2011-04-17',
  last_air_date: '2019-05-19',
  in_production: false,
  number_of_seasons: 8,
  number_of_episodes: 73,
  episode_run_time: [60],
  status: 'Ended',
  original_language: 'en',
  spoken_languages: [{ iso_639_1: 'en', english_name: 'English' }],
  genres: [{ id: 18, name: 'Drama' }],
  networks: [{ id: 49, name: 'HBO' }],
  created_by: [
    { id: 1, name: 'David Benioff' },
    { id: 2, name: 'D. B. Weiss' },
  ],
  vote_average: 8.4,
  vote_count: 24000,
}

const factValue = (facts: { label: string; value: string }[], label: string) =>
  facts.find((fact) => fact.label === label)?.value

describe('mediaFacts', () => {
  it('writes a sentence no other title could produce', () => {
    expect(mediaFacts('movie', movie).intro).toBe(
      'The Quiet Hour is a Japanese drama and thriller movie released on 15 March 2024, running 2h 3m.'
    )
  })

  it('describes a finished series by its run, not its release date', () => {
    expect(mediaFacts('tv', series).intro).toBe(
      'Game of Thrones is an English drama series that ran from 2011 to 2019, across 8 seasons and 73 episodes, on HBO.'
    )
  })

  it('keeps the FULL synopsis, not the meta description cut', () => {
    expect(mediaFacts('movie', movie).overview).toBe(movie.overview)
  })

  it('lists the facts a detail page shows', () => {
    const { facts } = mediaFacts('movie', movie)
    expect(factValue(facts, 'Released')).toBe('15 March 2024')
    expect(factValue(facts, 'Runtime')).toBe('2h 3m')
    expect(factValue(facts, 'Genres')).toBe('Drama, Thriller')
    expect(factValue(facts, 'Language')).toBe('Japanese')
    expect(factValue(facts, 'Rating')).toBe('7.3/10 from 48 TMDB votes')
    expect(factValue(facts, 'Original title')).toBe('Shizuka na Jikan')
  })

  it('reports no rating rather than 0.0/10 when TMDB has no votes', () => {
    const unrated = mediaFacts('movie', { ...movie, vote_count: 0 })
    expect(unrated.rating).toBeNull()
    expect(factValue(unrated.facts, 'Rating')).toBeUndefined()
  })

  it('links only hubs that exist', () => {
    const { links } = mediaFacts('movie', movie)
    expect(links.map((link) => link.href)).toEqual([
      '/movies/genre/drama',
      '/movies/genre/thriller',
      '/movies/year/2024',
      '/collection/999',
    ])
  })

  it('does not link a year hub that was never built', () => {
    const old = mediaFacts('movie', { ...movie, release_date: '1974-05-01' })
    expect(old.links.some((link) => link.href.includes('/year/'))).toBe(false)
  })

  it('links tv genres to the tv hubs', () => {
    expect(mediaFacts('tv', series).links[0].href).toBe('/tv-shows/genre/drama')
  })

  it('gives schema.org a duration it accepts', () => {
    expect(mediaFacts('movie', movie).duration).toBe('PT2H3M')
    expect(mediaFacts('tv', series).duration).toBe('PT1H')
  })

  it('survives a payload with almost nothing in it', () => {
    const bare = mediaFacts('movie', { id: 5, title: 'Untitled Thing' })
    expect(bare.intro).toBe('Untitled Thing is a movie.')
    expect(bare.facts).toEqual([])
    expect(bare.links).toEqual([])
    expect(bare.duration).toBe('')
  })
})
