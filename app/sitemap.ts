export const revalidate = 86400

import { siteConfig } from '@/config/site'
import { MOVIE_GENRES_WITH_SLUG, TV_GENRES_WITH_SLUG } from '@/lib/genres'
import {
  getPopularMovies,
  getAllTimeTopRatedMovies,
  getLatestTrendingMovies,
  getNowPlayingMovies,
} from '@/services/movies'
import {
  getPopularSeries,
  getAllTimeTopRatedSeries,
  getLatestTrendingSeries,
} from '@/services/series'
import type { MetadataRoute } from 'next'

const baseUrl = siteConfig.websiteURL

const buildDate = (): string => new Date().toISOString()

// Dedup a set of TMDB list responses into id→item, keeping the first-seen item
// (so `popularity` survives for the priority calc). allSettled: one 429 drops
// just that page, never the whole sitemap.
const dedupeResults = async <T extends { id: number; popularity?: number }>(
  requests: Promise<{ results?: T[] } | undefined>[]
): Promise<T[]> => {
  const responses = await Promise.allSettled(requests)
  const byId = new Map<number, T>()
  for (const res of responses) {
    if (res.status !== 'fulfilled') continue
    for (const item of res.value?.results ?? []) {
      if (!byId.has(item.id)) byId.set(item.id, item)
    }
  }
  return Array.from(byId.values())
}

// Kept in step with generateStaticParams on the detail pages: the sitemap should
// advertise the same head of titles we prebuild as static assets, so every URL
// Google discovers here resolves to a fast, no-Worker-CPU page (no 5xx).
const generateMovieUrls = async (): Promise<MetadataRoute.Sitemap> => {
  try {
    const movies = await dedupeResults([
      ...Array.from({ length: 60 }, (_, i) => getPopularMovies({ page: i + 1 })),
      ...Array.from({ length: 40 }, (_, i) =>
        getAllTimeTopRatedMovies({ page: i + 1 })
      ),
      ...Array.from({ length: 15 }, (_, i) =>
        getNowPlayingMovies({ page: i + 1 })
      ),
      ...Array.from({ length: 10 }, (_, i) =>
        getLatestTrendingMovies({ page: i + 1 })
      ),
    ])

    const lastModified = buildDate()
    return movies.map((movie) => ({
      url: `${baseUrl}/movies/${movie.id}`,
      lastModified,
      changeFrequency: 'monthly' as const,
      priority: (movie.popularity ?? 0) > 50 ? 0.8 : 0.6,
    }))
  } catch (error) {
    console.error('Error generating movie URLs for sitemap:', error)
    return []
  }
}

const generateTVShowUrls = async (): Promise<MetadataRoute.Sitemap> => {
  try {
    const series = await dedupeResults([
      ...Array.from({ length: 60 }, (_, i) => getPopularSeries({ page: i + 1 })),
      ...Array.from({ length: 40 }, (_, i) =>
        getAllTimeTopRatedSeries({ page: i + 1 })
      ),
      ...Array.from({ length: 10 }, (_, i) =>
        getLatestTrendingSeries({ page: i + 1 })
      ),
    ])

    const lastModified = buildDate()
    return series.map((show) => ({
      url: `${baseUrl}/tv-shows/${show.id}`,
      lastModified,
      changeFrequency: 'monthly' as const,
      priority: (show.popularity ?? 0) > 50 ? 0.8 : 0.6,
    }))
  } catch (error) {
    console.error('Error generating TV show URLs for sitemap:', error)
    return []
  }
}

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
