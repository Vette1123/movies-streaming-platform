import { siteConfig } from '@/config/site'
import { getPopularMovies, getAllTimeTopRatedMovies, getLatestTrendingMovies } from '@/services/movies'
import { getPopularSeries, getAllTimeTopRatedSeries, getLatestTrendingSeries } from '@/services/series'
import type { MetadataRoute } from 'next'

 const baseUrl = siteConfig.websiteURL

const generateMovieUrls = async (): Promise<MetadataRoute.Sitemap> => {
  try {
    // Fetch multiple sources of movies for comprehensive coverage
    const [popularMovies, topRatedMovies, trendingMovies] = await Promise.all([
      getPopularMovies({ page: 1 }),
      getAllTimeTopRatedMovies({ page: 1 }),
      getLatestTrendingMovies({ page: 1 }),
    ])

    // Combine all movies and remove duplicates
    const allMovies = [
      ...(popularMovies?.results || []),
      ...(topRatedMovies?.results || []),
      ...(trendingMovies?.results || []),
    ]

    // Remove duplicates by ID
    const uniqueMovies = allMovies.filter(
      (movie, index, self) => 
        index === self.findIndex(m => m.id === movie.id)
    )

    return uniqueMovies.map((movie) => ({
      url: `${baseUrl}/movies/${movie.id}`,
      lastModified: new Date().toISOString(),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
      images: movie.poster_path 
        ? [`https://image.tmdb.org/t/p/w500${movie.poster_path}`]
        : undefined
    }))
  } catch (error) {
    console.error('Error generating movie URLs for sitemap:', error)
    return []
  }
}

const generateTVShowUrls = async (): Promise<MetadataRoute.Sitemap> => {
  try {
    // Fetch multiple sources of TV shows for comprehensive coverage
    const [popularSeries, topRatedSeries, trendingSeries] = await Promise.all([
      getPopularSeries({ page: 1 }),
      getAllTimeTopRatedSeries({ page: 1 }),
      getLatestTrendingSeries({ page: 1 }),
    ])

    // Combine all series and remove duplicates
    const allSeries = [
      ...(popularSeries?.results || []),
      ...(topRatedSeries?.results || []),
      ...(trendingSeries?.results || []),
    ]

    // Remove duplicates by ID
    const uniqueSeries = allSeries.filter(
      (series, index, self) => 
        index === self.findIndex(s => s.id === series.id)
    )

    return uniqueSeries.map((series) => ({
      url: `${baseUrl}/tv-shows/${series.id}`,
      lastModified: new Date().toISOString(),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
      images: series.poster_path 
        ? [`https://image.tmdb.org/t/p/w500${series.poster_path}`]
        : undefined
    }))
  } catch (error) {
    console.error('Error generating TV show URLs for sitemap:', error)
    return []
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const currentDate = new Date().toISOString()

  // Static routes with SEO optimization
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: currentDate,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/movies`,
      lastModified: currentDate,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/tv-shows`,
      lastModified: currentDate,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/watch-history`,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/disclaimer`,
      lastModified: currentDate,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ]

  try {
    // Generate dynamic routes for movies and TV shows
    const [movieUrls, tvShowUrls] = await Promise.all([
      generateMovieUrls(),
      generateTVShowUrls(),
    ])

    // Combine all routes
    const allRoutes = [...staticRoutes, ...movieUrls, ...tvShowUrls]

    // Sort by priority (highest first) and then by URL for consistency
    return allRoutes.sort((a, b) => {
      const priorityDiff = (b.priority || 0) - (a.priority || 0)
      if (priorityDiff !== 0) return priorityDiff
      return a.url.localeCompare(b.url)
    })
  } catch (error) {
    console.error('Error generating sitemap:', error)
    // Return at least static routes if dynamic generation fails
    return staticRoutes
  }
}
