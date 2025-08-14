import { getServerSideSitemap } from 'next-sitemap'
import { 
  getPopularMovies, 
  getAllTimeTopRatedMovies, 
  getLatestTrendingMovies,
  getNowPlayingMovies 
} from '@/services/movies'
import { siteConfig } from '@/config/site'

export async function GET(request: Request) {
  const baseUrl = siteConfig.websiteURL
  
  try {
    // Fetch different types of movies
    const [popularMovies, topRatedMovies, trendingMovies, nowPlayingMovies] = await Promise.all([
      getPopularMovies({ page: 1 }),
      getAllTimeTopRatedMovies({ page: 1 }),
      getLatestTrendingMovies({ page: 1 }),
      getNowPlayingMovies({ page: 1 })
    ])

    // Get additional pages for more comprehensive coverage
    const [popularPage2, topRatedPage2, trendingPage2] = await Promise.all([
      getPopularMovies({ page: 2 }),
      getAllTimeTopRatedMovies({ page: 2 }),
      getLatestTrendingMovies({ page: 2 })
    ])

    // Combine all movie results and remove duplicates
    const allMovies = [
      ...(popularMovies?.results || []),
      ...(topRatedMovies?.results || []),
      ...(trendingMovies?.results || []),
      ...(nowPlayingMovies?.results || []),
      ...(popularPage2?.results || []),
      ...(topRatedPage2?.results || []),
      ...(trendingPage2?.results || [])
    ]

    // Remove duplicates based on movie ID
    const uniqueMovies = allMovies.filter((movie, index, self) => 
      index === self.findIndex(m => m.id === movie.id)
    )

    // Generate sitemap fields
    const fields = uniqueMovies.map((movie) => ({
      loc: `${baseUrl}/movies/${movie.id}`,
      lastmod: new Date().toISOString(),
      changefreq: 'weekly' as const,
      priority: movie.popularity > 50 ? 0.8 : 0.6,
    }))

    // Add static movie routes
    const staticRoutes = [
      {
        loc: `${baseUrl}/movies`,
        lastmod: new Date().toISOString(),
        changefreq: 'daily' as const,
        priority: 0.9,
      }
    ]

    return getServerSideSitemap([...staticRoutes, ...fields])
  } catch (error) {
    console.error('Error generating movies sitemap:', error)
    
    // Return at least the static routes if API fails
    const fallbackRoutes = [
      {
        loc: `${baseUrl}/movies`,
        lastmod: new Date().toISOString(),
        changefreq: 'daily' as const,
        priority: 0.9,
      }
    ]
    
    return getServerSideSitemap(fallbackRoutes)
  }
}
