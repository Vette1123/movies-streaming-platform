import { getServerSideSitemap } from 'next-sitemap'
import { siteConfig } from '@/config/site'

export async function GET(request: Request) {
  const baseUrl = siteConfig.websiteURL
  
  // Static routes in your application
  const staticRoutes = [
    {
      loc: baseUrl,
      lastmod: new Date().toISOString(),
      changefreq: 'daily' as const,
      priority: 1.0,
    },
    {
      loc: `${baseUrl}/movies`,
      lastmod: new Date().toISOString(),
      changefreq: 'daily' as const,
      priority: 0.9,
    },
    {
      loc: `${baseUrl}/tv-shows`,
      lastmod: new Date().toISOString(),
      changefreq: 'daily' as const,
      priority: 0.9,
    },
    {
      loc: `${baseUrl}/watch-history`,
      lastmod: new Date().toISOString(),
      changefreq: 'weekly' as const,
      priority: 0.7,
    },
    {
      loc: `${baseUrl}/disclaimer`,
      lastmod: new Date().toISOString(),
      changefreq: 'monthly' as const,
      priority: 0.3,
    }
  ]

  return getServerSideSitemap(staticRoutes)
}
