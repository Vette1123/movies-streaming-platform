import { getServerSideSitemapIndex } from 'next-sitemap'
import { siteConfig } from '@/config/site'

export async function GET(request: Request) {
  const baseUrl = siteConfig.websiteURL

  return getServerSideSitemapIndex([
    `${baseUrl}/sitemap-static.xml`,
    `${baseUrl}/sitemap-movies.xml`,
    `${baseUrl}/sitemap-tv-shows.xml`,
    `${baseUrl}/sitemap-trending.xml`,
  ])
}