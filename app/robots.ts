import type { MetadataRoute } from 'next'

import { siteConfig } from '@/config/site'

const baseUrl = siteConfig.websiteURL

// Required by `output: 'export'`: a metadata route must declare that it renders
// once at build time rather than per request. Emits a static out/robots.txt.
export const dynamic = 'force-static'

// One list rather than the same nine lines copied into each rule block.
const CRAWL_DISALLOW = [
  '/api/',
  '/watch-history',
  '/admin/',
  '/private/',
  '/auth/',
  '/login',
  '/register',
  '/*?*',
  // The two fallback shells are an implementation detail: cloudflare/worker.js
  // serves their exported HTML under the real /movies/<id>, /tv-shows/<id> and
  // /collection/<id> URLs, with the title, OG tags, JSON-LD and an <h1>
  // injected. Fetched at their own bare path they are an empty skeleton with
  // no heading, which is what an SEO crawl reports as a missing <h1>. They
  // already carry noindex; this stops a crawler spending a fetch on them.
  '/media-fallback',
  '/collection-fallback',
]

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
        disallow: CRAWL_DISALLOW,
      },
      {
        userAgent: '*',
        allow: ['/'],
        disallow: CRAWL_DISALLOW,
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
      // AI *training* crawlers. These were only ever disallowed by Cloudflare's
      // managed robots.txt, which scripts/cf-waf-setup.mjs now turns off (it
      // replaced this whole file at the edge and dropped the `Sitemap:` line
      // with it), so the rules move here or they are gone.
      //
      // The AI *search* crawlers are deliberately NOT in this list —
      // OAI-SearchBot, ChatGPT-User and PerplexityBot fetch a page to cite it to
      // a user, which is a referral, not training. Blocking them would remove
      // the site from AI answers for no gain.
      {
        userAgent: [
          'GPTBot',
          'ClaudeBot',
          'anthropic-ai',
          'CCBot',
          'Google-Extended',
          'Applebot-Extended',
          'meta-externalagent',
          'FacebookBot',
          'Bytespider',
          'Amazonbot',
          'cohere-ai',
          'Diffbot',
          'omgili',
        ],
        disallow: '/',
      },
    ],
    sitemap: [`${baseUrl}/sitemap.xml`],
    host: baseUrl,
  }
}
