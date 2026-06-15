export const revalidate = 86400

import { siteConfig } from '@/config/site'
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

const generateMovieUrls = async (): Promise<MetadataRoute.Sitemap> => {
  try {
    const [p1, p2, tr1, tr2, tp1, tp2, np] = await Promise.all([
      getPopularMovies({ page: 1 }),
      getPopularMovies({ page: 2 }),
      getLatestTrendingMovies({ page: 1 }),
      getLatestTrendingMovies({ page: 2 }),
      getAllTimeTopRatedMovies({ page: 1 }),
      getAllTimeTopRatedMovies({ page: 2 }),
      getNowPlayingMovies({ page: 1 }),
    ])

    const all = [
      ...(p1?.results || []),
      ...(p2?.results || []),
      ...(tr1?.results || []),
      ...(tr2?.results || []),
      ...(tp1?.results || []),
      ...(tp2?.results || []),
      ...(np?.results || []),
    ]

    const unique = all.filter(
      (m, i, self) => i === self.findIndex((x) => x.id === m.id)
    )

    const lastModified = buildDate()
    return unique.map((movie) => ({
      url: `${baseUrl}/movies/${movie.id}`,
      lastModified,
      changeFrequency: 'monthly' as const,
      priority: (movie as any).popularity > 50 ? 0.8 : 0.6,
    }))
  } catch (error) {
    console.error('Error generating movie URLs for sitemap:', error)
    return []
  }
}

const generateTVShowUrls = async (): Promise<MetadataRoute.Sitemap> => {
  try {
    const [p1, p2, tr1, tr2, tp1, tp2] = await Promise.all([
      getPopularSeries({ page: 1 }),
      getPopularSeries({ page: 2 }),
      getLatestTrendingSeries({ page: 1 }),
      getLatestTrendingSeries({ page: 2 }),
      getAllTimeTopRatedSeries({ page: 1 }),
      getAllTimeTopRatedSeries({ page: 2 }),
    ])

    const all = [
      ...(p1?.results || []),
      ...(p2?.results || []),
      ...(tr1?.results || []),
      ...(tr2?.results || []),
      ...(tp1?.results || []),
      ...(tp2?.results || []),
    ]

    const unique = all.filter(
      (s, i, self) => i === self.findIndex((x) => x.id === s.id)
    )

    const lastModified = buildDate()
    return unique.map((series) => ({
      url: `${baseUrl}/tv-shows/${series.id}`,
      lastModified,
      changeFrequency: 'monthly' as const,
      priority: (series as any).popularity > 50 ? 0.8 : 0.6,
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
