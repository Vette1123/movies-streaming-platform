import { siteConfig } from '@/config/site'
import { getLatestTrendingMovies } from '@/services/movies'
import { getLatestTrendingSeries } from '@/services/series'

const baseUrl = siteConfig.websiteURL

export async function GET() {
  try {
    // Fetch latest content for news sitemap
    const [trendingMovies, trendingSeries] = await Promise.all([
      getLatestTrendingMovies({ page: 1 }),
      getLatestTrendingSeries({ page: 1 }),
    ])

    // Generate news sitemap XML
    const generateNewsSitemap = () => {
      const currentDate = new Date().toISOString()
      let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">`

      // Add trending movies as news
      trendingMovies?.results?.slice(0, 10).forEach((movie) => {
        const releaseDate = movie.release_date ? new Date(movie.release_date) : new Date()
        const publicationDate = releaseDate > new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) 
          ? releaseDate.toISOString() 
          : currentDate

        xml += `
  <url>
    <loc>${baseUrl}/movies/${movie.id}</loc>
    <news:news>
      <news:publication>
        <news:name>Reely</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>${publicationDate}</news:publication_date>
      <news:title>${escapeXml(movie.title || 'Latest Movie')}</news:title>
      <news:keywords>movie, trending, ${escapeXml(movie.title || '')}, entertainment, cinema</news:keywords>
    </news:news>
    <lastmod>${currentDate}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>`
      })

      // Add trending TV series as news
      trendingSeries?.results?.slice(0, 10).forEach((series) => {
        const releaseDate = series.first_air_date ? new Date(series.first_air_date) : new Date()
        const publicationDate = releaseDate > new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) 
          ? releaseDate.toISOString() 
          : currentDate

        xml += `
  <url>
    <loc>${baseUrl}/tv-shows/${series.id}</loc>
    <news:news>
      <news:publication>
        <news:name>Reely</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>${publicationDate}</news:publication_date>
      <news:title>${escapeXml(series.name || 'Latest TV Show')}</news:title>
      <news:keywords>tv show, trending, ${escapeXml(series.name || '')}, television, series</news:keywords>
    </news:news>
    <lastmod>${currentDate}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>`
      })

      xml += `
</urlset>`
      return xml
    }

    const sitemapXml = generateNewsSitemap()

    return new Response(sitemapXml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=1800, s-maxage=3600', // Cache for 30min-1hour
      },
    })
  } catch (error) {
    console.error('Error generating news sitemap:', error)
    return new Response('Error generating news sitemap', { status: 500 })
  }
}

// Helper function to escape XML special characters
const escapeXml = (str: string): string => {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
} 