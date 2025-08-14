import { getServerSideSitemap } from 'next-sitemap'
import { 
  getPopularSeries, 
  getAllTimeTopRatedSeries, 
  getLatestTrendingSeries 
} from '@/services/series'
import { siteConfig } from '@/config/site'

export async function GET(request: Request) {
  const baseUrl = siteConfig.websiteURL
  
  try {
    // Fetch different types of TV series
    const [popularSeries, topRatedSeries, trendingSeries] = await Promise.all([
      getPopularSeries({ page: 1 }),
      getAllTimeTopRatedSeries({ page: 1 }),
      getLatestTrendingSeries({ page: 1 })
    ])

    // Get additional pages for more comprehensive coverage
    const [popularPage2, topRatedPage2, trendingPage2] = await Promise.all([
      getPopularSeries({ page: 2 }),
      getAllTimeTopRatedSeries({ page: 2 }),
      getLatestTrendingSeries({ page: 2 })
    ])

    // Combine all series results and remove duplicates
    const allSeries = [
      ...(popularSeries?.results || []),
      ...(topRatedSeries?.results || []),
      ...(trendingSeries?.results || []),
      ...(popularPage2?.results || []),
      ...(topRatedPage2?.results || []),
      ...(trendingPage2?.results || [])
    ]

    // Remove duplicates based on series ID
    const uniqueSeries = allSeries.filter((series, index, self) => 
      index === self.findIndex(s => s.id === series.id)
    )

    // Generate sitemap fields
    const fields = uniqueSeries.map((series) => ({
      loc: `${baseUrl}/tv-shows/${series.id}`,
      lastmod: new Date().toISOString(),
      changefreq: 'weekly' as const,
      priority: series.popularity > 50 ? 0.8 : 0.6,
    }))

    // Add static TV show routes
    const staticRoutes = [
      {
        loc: `${baseUrl}/tv-shows`,
        lastmod: new Date().toISOString(),
        changefreq: 'daily' as const,
        priority: 0.9,
      }
    ]

    return getServerSideSitemap([...staticRoutes, ...fields])
  } catch (error) {
    console.error('Error generating TV shows sitemap:', error)
    
    // Return at least the static routes if API fails
    const fallbackRoutes = [
      {
        loc: `${baseUrl}/tv-shows`,
        lastmod: new Date().toISOString(),
        changefreq: 'daily' as const,
        priority: 0.9,
      }
    ]
    
    return getServerSideSitemap(fallbackRoutes)
  }
}
