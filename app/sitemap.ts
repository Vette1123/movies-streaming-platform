import type { MetadataRoute } from 'next'

export const baseUrl = 'https://www.reely.site'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const routes = ['', '/movies', '/tv-shows'].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date().toISOString().split('T')[0],
  }))

  return [...routes]
}
