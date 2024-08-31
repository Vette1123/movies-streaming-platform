import { MetadataRoute } from 'next'

import { baseUrl } from './sitemap'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: `${baseUrl}`,
  }
}
