import type { MetadataRoute } from 'next'
import {
  getAllTimeTopRatedMovies,
  getLatestTrendingMovies,
  getNowPlayingMovies,
  getPopularMovies,
} from '@/services/movies'
import {
  getAllTimeTopRatedSeries,
  getLatestTrendingSeries,
  getPopularSeries,
} from '@/services/series'

import { MediaResponse } from '@/types/media'
import { siteConfig } from '@/config/site'
import { MOVIE_GENRES_WITH_SLUG, TV_GENRES_WITH_SLUG } from '@/lib/genres'

export const revalidate = 86400

const baseUrl = siteConfig.websiteURL

const buildDate = (): string => new Date().toISOString()

// Fan out the paged fetchers, flatten + dedupe by id, and map each item to a
// sitemap entry under `pathPrefix`. Shared by movies and TV so the dedupe and
// priority heuristic stay identical; a failed fetch degrades to no rows.
const mediaSitemapUrls = async (
  pathPrefix: string,
  fetchers: Array<() => Promise<MediaResponse | undefined>>
): Promise<MetadataRoute.Sitemap> => {
  try {
    const pages = await Promise.all(fetchers.map((fetch) => fetch()))
    const all = pages.flatMap((page) => page?.results || [])
    const unique = all.filter(
      (item, i, self) => i === self.findIndex((x) => x.id === item.id)
    )

    const lastModified = buildDate()
    return unique.map((item) => ({
      url: `${baseUrl}${pathPrefix}/${item.id}`,
      lastModified,
      changeFrequency: 'monthly' as const,
      priority: (item as any).popularity > 50 ? 0.8 : 0.6,
    }))
  } catch (error) {
    console.error(`Error generating ${pathPrefix} URLs for sitemap:`, error)
    return []
  }
}

const generateMovieUrls = (): Promise<MetadataRoute.Sitemap> =>
  mediaSitemapUrls('/movies', [
    () => getPopularMovies({ page: 1 }),
    () => getPopularMovies({ page: 2 }),
    () => getLatestTrendingMovies({ page: 1 }),
    () => getLatestTrendingMovies({ page: 2 }),
    () => getAllTimeTopRatedMovies({ page: 1 }),
    () => getAllTimeTopRatedMovies({ page: 2 }),
    () => getNowPlayingMovies({ page: 1 }),
  ])

const generateTVShowUrls = (): Promise<MetadataRoute.Sitemap> =>
  mediaSitemapUrls('/tv-shows', [
    () => getPopularSeries({ page: 1 }),
    () => getPopularSeries({ page: 2 }),
    () => getLatestTrendingSeries({ page: 1 }),
    () => getLatestTrendingSeries({ page: 2 }),
    () => getAllTimeTopRatedSeries({ page: 1 }),
    () => getAllTimeTopRatedSeries({ page: 2 }),
  ])

const SITE_LAUNCH_DATE = '2024-01-01T00:00:00.000Z'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: SITE_LAUNCH_DATE,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/movies`,
      lastModified: SITE_LAUNCH_DATE,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/tv-shows`,
      lastModified: SITE_LAUNCH_DATE,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/disclaimer`,
      lastModified: SITE_LAUNCH_DATE,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    ...MOVIE_GENRES_WITH_SLUG.map((genre) => ({
      url: `${baseUrl}/movies/genre/${genre.slug}`,
      lastModified: SITE_LAUNCH_DATE,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
    ...TV_GENRES_WITH_SLUG.map((genre) => ({
      url: `${baseUrl}/tv-shows/genre/${genre.slug}`,
      lastModified: SITE_LAUNCH_DATE,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  ]

  try {
    const [movieUrls, tvShowUrls] = await Promise.all([
      generateMovieUrls(),
      generateTVShowUrls(),
    ])

    return [...staticRoutes, ...movieUrls, ...tvShowUrls].sort((a, b) => {
      const diff = (b.priority || 0) - (a.priority || 0)
      return diff !== 0 ? diff : a.url.localeCompare(b.url)
    })
  } catch (error) {
    console.error('Error generating sitemap:', error)
    return staticRoutes
  }
}
