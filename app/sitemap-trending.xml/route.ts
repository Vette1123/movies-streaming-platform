import { getServerSideSitemap } from 'next-sitemap'
import { getTrendingMediaForHeroSlider, getLatestTrendingMovies } from '@/services/movies'
import { getLatestTrendingSeries } from '@/services/series'
import { siteConfig } from '@/config/site'

export async function GET(request: Request) {
  const baseUrl = siteConfig.websiteURL
  
  try {
    // Fetch trending content from different sources
    const [trendingMedia, trendingMovies, trendingSeries] = await Promise.all([
      getTrendingMediaForHeroSlider(),
      getLatestTrendingMovies({ page: 1 }),
      getLatestTrendingSeries({ page: 1 })
    ])

    // Combine all trending results
    const allTrending = [
      ...(trendingMedia || []), // trendingMedia is already Movie[]
      ...(trendingMovies?.results || []),
      ...(trendingSeries?.results || [])
    ]

    // Remove duplicates based on ID and media type
    const uniqueTrending = allTrending.filter((item, index, self) => 
      index === self.findIndex(t => t.id === item.id && (t.media_type === item.media_type || 
        (t.title && item.title) || (t.name && item.name)))
    )

    // Generate sitemap fields based on media type
    const fields = uniqueTrending.map((item) => {
      const isMovie = item.media_type === 'movie' || item.title
      const route = isMovie ? 'movies' : 'tv-shows'
      
      return {
        loc: `${baseUrl}/${route}/${item.id}`,
        lastmod: new Date().toISOString(),
        changefreq: 'daily' as const,
        priority: 0.9, // Trending content gets high priority
      }
    })

    return getServerSideSitemap(fields)
  } catch (error) {
    console.error('Error generating trending sitemap:', error)
    
    // Return empty sitemap if API fails
    return getServerSideSitemap([])
  }
}
