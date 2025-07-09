import { siteConfig } from '@/config/site'
import { MetadataRoute } from 'next'

const baseUrl = siteConfig.websiteURL

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Main crawlers - full access with optimizations
      {
        userAgent: ['Googlebot', 'Bingbot', 'DuckDuckBot', 'facebookexternalhit'],
        allow: [
          '/',
          '/movies',
          '/tv-shows', 
          '/movies/*',
          '/tv-shows/*',
          '/disclaimer',
          '/_next/static/',
          '/api/og/*', // Allow OG image generation
        ],
        disallow: [
          '/api/*',
          '/_next/',
          '/admin/',
          '/private/',
          '*.json$',
          '/watch-history', // Private user data
          '/user/',
          '/auth/',
          '/login',
          '/register',
        ],
        crawlDelay: 1, // Be respectful - 1 second delay
      },
      // Social media crawlers - optimized for sharing
      {
        userAgent: ['LinkedInBot', 'WhatsApp', 'TwitterBot', 'TelegramBot'],
        allow: [
          '/',
          '/movies/*',
          '/tv-shows/*',
          '/api/og/*', // Allow OG image generation
          '/_next/static/',
        ],
        disallow: [
          '/api/*',
          '/watch-history',
          '/user/',
          '/admin/',
        ],
      },
      // General crawlers - standard access
      {
        userAgent: '*',
        allow: [
          '/',
          '/movies',
          '/tv-shows',
          '/movies/*',
          '/tv-shows/*',
          '/disclaimer',
        ],
        disallow: [
          '/api/',
          '/_next/',
          '/admin/',
          '/private/',
          '/watch-history',
          '/user/',
          '/auth/',
          '/login',
          '/register',
          '*.json$',
          '/*?*', // Disallow query parameters to avoid duplicate content
        ],
        crawlDelay: 2,
      },
      // Block malicious bots
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
    sitemap: [
      `${baseUrl}/sitemap.xml`,
      `${baseUrl}/sitemap-index.xml`,
      `${baseUrl}/sitemap-images.xml`,
      `${baseUrl}/sitemap-news.xml`,
    ],
    host: baseUrl,
  }
}
