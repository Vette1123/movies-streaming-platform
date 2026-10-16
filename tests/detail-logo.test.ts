import { beforeEach, describe, expect, it, vi } from 'vitest'

// The detail hero shows the title's wordmark, and it must arrive on the ONE
// detail request a page makes (the free-plan rule), with the raw `images`
// block peeled off before anything is serialised to the client.
const get = vi.fn()
vi.mock('@/lib/fetch-client', () => ({
  fetchClient: { get: (...args: unknown[]) => get(...args) },
  isNotFoundError: () => false,
}))

const { populateMovieDetailsPage } = await import('@/services/movies')
const { populateSeriesDetailsPageData } = await import('@/services/series')

const logos = [
  {
    file_path: '/svg.svg',
    iso_639_1: 'en',
    vote_count: 99,
    vote_average: 9,
    width: 1,
    height: 1,
    aspect_ratio: 1,
  },
  {
    file_path: '/low.png',
    iso_639_1: 'en',
    vote_count: 1,
    vote_average: 5,
    width: 1,
    height: 1,
    aspect_ratio: 1,
  },
  {
    file_path: '/best.png',
    iso_639_1: 'en',
    vote_count: 8,
    vote_average: 5,
    width: 1,
    height: 1,
    aspect_ratio: 1,
  },
]

beforeEach(() => get.mockReset())

describe('detail payload wordmark', () => {
  it('rides the movie detail request and leaves only the path', async () => {
    get.mockResolvedValue({ id: 603, title: 'The Matrix', images: { logos } })
    const result = await populateMovieDetailsPage('603')
    expect(get).toHaveBeenCalledTimes(1)
    expect(get.mock.calls[0][0]).toMatch(
      /append_to_response=[^&]*\bimages\b.*&include_image_language=en$/
    )
    expect(result.logoPath).toBe('/best.png')
    expect(result.movieDetails).not.toHaveProperty('images')
  })

  it('does the same for a series, and says null when there is none', async () => {
    get.mockResolvedValue({
      id: 1396,
      name: 'Breaking Bad',
      images: { logos: [] },
    })
    const result = await populateSeriesDetailsPageData('1396')
    expect(get).toHaveBeenCalledTimes(1)
    expect(get.mock.calls[0][0]).toContain('images')
    expect(result.logoPath).toBeNull()
    expect(result.seriesDetails).not.toHaveProperty('images')
  })
})
