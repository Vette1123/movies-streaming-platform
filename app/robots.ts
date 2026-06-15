import type { MetadataRoute } from 'next'

import { siteConfig } from '@/config/site'

const baseUrl = siteConfig.websiteURL

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: [
          'Googlebot',
          'Bingbot',
          'DuckDuckBot',
          'facebookexternalhit',
          'LinkedInBot',
          'WhatsApp',
          'TwitterBot',
          'TelegramBot',
          'Slackbot',
          'Applebot',
        ],
        allow: ['/'],
        disallow: [
          '/api/',
          '/watch-history',
          '/admin/',
          '/private/',
          '/auth/',
          '/login',
          '/register',
          '/*?*',
        ],
      },
      {
        userAgent: '*',
        allow: ['/'],
        disallow: [
          '/api/',
          '/watch-history',
          '/admin/',
          '/private/',
          '/auth/',
          '/login',
          '/register',
          '/*?*',
        ],
      },
      {
        userAgent: [
          'AhrefsBot',
          'SemrushBot',
          'MJ12bot',
          'DotBot',
          'AspiegelBot',
          'DataForSeoBot',
          'BLEXBot',
          'PetalBot',
        ],
        disallow: '/',
      },
    ],
    sitemap: [`${baseUrl}/sitemap.xml`],
    host: baseUrl,
  }
}
