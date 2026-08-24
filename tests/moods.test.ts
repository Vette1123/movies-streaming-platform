import { describe, expect, it } from 'vitest'

import { moodById, MOODS, moodToFilters } from '@/lib/moods'

// TMDB keeps two genre vocabularies and they are not interchangeable: the TV
// list has no horror (27), no romance (10749), no sci-fi (878) and no action
// (28). A mood compiled with movie ids against /discover/tv comes back EMPTY —
// a silent failure that looks like "no series match this mood".
const MOVIE_ONLY_GENRE_IDS = new Set([
  28, 12, 14, 27, 36, 53, 878, 10749, 10402,
])

describe('moods', () => {
  it('gives every mood both genre vocabularies', () => {
    for (const mood of MOODS) {
      expect(mood.genres.length, mood.id).toBeGreaterThan(0)
      expect(mood.tvGenres.length, mood.id).toBeGreaterThan(0)
    }
  })

  it('never compiles a movie-only genre into a TV query', () => {
    for (const mood of MOODS) {
      for (const id of mood.tvGenres) {
        expect(MOVIE_ONLY_GENRE_IDS.has(id), `${mood.id} -> ${id}`).toBe(false)
      }
    }
  })

  it('compiles a mood to the discover params of the requested type', () => {
    const adrenaline = moodById('adrenaline')!
    expect(moodToFilters(adrenaline)).toEqual({
      with_genres: '28|53',
      sort_by: 'popularity.desc',
      'vote_average.gte': 6.5,
      'vote_count.gte': 300,
    })
    expect(moodToFilters(adrenaline, 'tv')).toEqual({
      with_genres: '10759|80',
      sort_by: 'popularity.desc',
      'vote_average.gte': 6.5,
      // Sorting by rating with a low floor surfaces titles nobody has heard
      // of; measured, 400 is where TV comedy starts returning Rick and Morty.
      'vote_count.gte': 400,
    })
  })

  it('has a stable id per mood', () => {
    expect(new Set(MOODS.map((mood) => mood.id)).size).toBe(MOODS.length)
    expect(moodById('nope')).toBeUndefined()
    expect(moodById(null)).toBeUndefined()
  })
})
