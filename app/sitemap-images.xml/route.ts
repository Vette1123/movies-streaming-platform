import { siteConfig } from '@/config/site'
import { getPopularMovies, getAllTimeTopRatedMovies } from '@/services/movies'
import { getPopularSeries, getAllTimeTopRatedSeries } from '@/services/series'

const baseUrl = siteConfig.websiteURL

export async function GET() {
  try {
    // Fetch movies and TV shows for image sitemap
    const [popularMovies, topRatedMovies, popularSeries, topRatedSeries] = await Promise.all([
      getPopularMovies({ page: 1 }),
      getAllTimeTopRatedMovies({ page: 1 }),
      getPopularSeries({ page: 1 }),
      getAllTimeTopRatedSeries({ page: 1 }),
    ])

    // Generate image sitemap XML
    const generateImageSitemap = () => {
      let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">`

      // Add movie images
      popularMovies?.results?.forEach((movie) => {
        if (movie.poster_path && movie.backdrop_path) {
          xml += `
  <url>
    <loc>${baseUrl}/movies/${movie.id}</loc>
    <image:image>
      <image:loc>https://image.tmdb.org/t/p/w500${movie.poster_path}</image:loc>
      <image:title>${escapeXml(movie.title || 'Movie')}</image:title>
      <image:caption>${escapeXml(movie.overview?.substring(0, 200) || '')}</image:caption>
    </image:image>
    <image:image>
      <image:loc>https://image.tmdb.org/t/p/original${movie.backdrop_path}</image:loc>
      <image:title>${escapeXml(movie.title || 'Movie')} - Backdrop</image:title>
      <image:caption>${escapeXml(movie.overview?.substring(0, 200) || '')}</image:caption>
    </image:image>
  </url>`
        }
      })

      // Add top-rated movie images
      topRatedMovies?.results?.forEach((movie) => {
        if (movie.poster_path && movie.backdrop_path) {
          xml += `
  <url>
    <loc>${baseUrl}/movies/${movie.id}</loc>
    <image:image>
      <image:loc>https://image.tmdb.org/t/p/w500${movie.poster_path}</image:loc>
      <image:title>${escapeXml(movie.title || 'Movie')}</image:title>
      <image:caption>${escapeXml(movie.overview?.substring(0, 200) || '')}</image:caption>
    </image:image>
    <image:image>
      <image:loc>https://image.tmdb.org/t/p/original${movie.backdrop_path}</image:loc>
      <image:title>${escapeXml(movie.title || 'Movie')} - Backdrop</image:title>
      <image:caption>${escapeXml(movie.overview?.substring(0, 200) || '')}</image:caption>
    </image:image>
  </url>`
        }
      })

      // Add TV series images
      popularSeries?.results?.forEach((series) => {
        if (series.poster_path && series.backdrop_path) {
          xml += `
  <url>
    <loc>${baseUrl}/tv-shows/${series.id}</loc>
    <image:image>
      <image:loc>https://image.tmdb.org/t/p/w500${series.poster_path}</image:loc>
      <image:title>${escapeXml(series.name || 'TV Show')}</image:title>
      <image:caption>${escapeXml(series.overview?.substring(0, 200) || '')}</image:caption>
    </image:image>
    <image:image>
      <image:loc>https://image.tmdb.org/t/p/original${series.backdrop_path}</image:loc>
      <image:title>${escapeXml(series.name || 'TV Show')} - Backdrop</image:title>
      <image:caption>${escapeXml(series.overview?.substring(0, 200) || '')}</image:caption>
    </image:image>
  </url>`
        }
      })

      // Add top-rated series images
      topRatedSeries?.results?.forEach((series) => {
        if (series.poster_path && series.backdrop_path) {
          xml += `
  <url>
    <loc>${baseUrl}/tv-shows/${series.id}</loc>
    <image:image>
      <image:loc>https://image.tmdb.org/t/p/w500${series.poster_path}</image:loc>
      <image:title>${escapeXml(series.name || 'TV Show')}</image:title>
      <image:caption>${escapeXml(series.overview?.substring(0, 200) || '')}</image:caption>
    </image:image>
    <image:image>
      <image:loc>https://image.tmdb.org/t/p/original${series.backdrop_path}</image:loc>
      <image:title>${escapeXml(series.name || 'TV Show')} - Backdrop</image:title>
      <image:caption>${escapeXml(series.overview?.substring(0, 200) || '')}</image:caption>
    </image:image>
  </url>`
        }
      })

      xml += `
</urlset>`
      return xml
    }

    const sitemapXml = generateImageSitemap()

    return new Response(sitemapXml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600, s-maxage=7200', // Cache for 1-2 hours
      },
    })
  } catch (error) {
    console.error('Error generating image sitemap:', error)
    return new Response('Error generating image sitemap', { status: 500 })
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