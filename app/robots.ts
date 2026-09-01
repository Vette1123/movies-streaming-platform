import type { MetadataRoute } from 'next'

import blockedCrawlers from '@/config/blocked-crawlers.json'
import { siteConfig } from '@/config/site'

const baseUrl = siteConfig.websiteURL

// Required by `output: 'export'`: a metadata route must declare that it renders
// once at build time rather than per request. Emits a static out/robots.txt.
export const dynamic = 'force-static'

// Icon routes, exempt from the `/*?*` rule below.
//
// Next fingerprints its metadata icons with a query (`/icon?f3b7d5758ff5c7f0`),
// so `Disallow: /*?*` swallowed them and Search Console filed the site's own
// favicon under "Blocked by robots.txt". Google resolves a conflict by the
// longest matching pattern, and `/icon` (5) beats `/*?*` (4), so an explicit
// Allow is enough. The URLs are dead — no build since the icon rework emits
// them — and letting Google fetch them is precisely the point: an honest 404
// drops them, while a robots block leaves them listed forever.
const CRAWL_ALLOW = ['/', '/icon', '/apple-icon', '/favicon.ico']

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
  // are answered with an X-Robots-Tag (public/_headers); this stops a crawler
  // spending a fetch on them at all.
  '/media-fallback',
  '/collection-fallback',
  '/list-fallback',
  '/profile-fallback',
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
        allow: CRAWL_ALLOW,
        disallow: CRAWL_DISALLOW,
        // Google has never supported Crawl-delay and ignores this line, which
        // is the intent — Google is the one crawler that should not be
        // throttled. bingbot, DuckDuckBot and Applebot all honour it, and
        // Applebot is why the number is here: 218 requests per 40 minutes on
        // 2026-09-01, ~7,800/day, against a 100,000/day invocation cap it
        // shares with everyone else. 20 seconds caps a compliant crawler at
        // 4,320/day, which is more than enough to keep a ~14,900-URL catalogue
        // current and roughly half what Applebot was taking.
        crawlDelay: 20,
      },
      // Everything else, at a rate this site can afford.
      //
      // `Crawl-delay` is a request for one fetch every N seconds. Google has
      // never supported it and ignores it (that group above is the one that
      // matters and is deliberately left unthrottled); bingbot honours it, and
      // so do most of the long tail of small crawlers that arrive with a
      // browser-shaped user-agent and no referral to show for it. 10 seconds
      // caps a compliant crawler at 8,640 requests/day.
      //
      // The number exists because of what a tail URL costs here: the site
      // advertises ~14,900 URLs and prerenders ~1,000 of them, so every crawl
      // of the other ~13,900 is a Worker invocation against a 100,000/day
      // free-plan cap. Crawl rate is a budget line, not a politeness setting.
      {
        userAgent: '*',
        allow: CRAWL_ALLOW,
        disallow: CRAWL_DISALLOW,
        crawlDelay: 10,
      },
      // Refused outright, and refused twice: these same tokens drive the WAF
      // block rule in scripts/cf-waf-setup.mjs. robots.txt is a request and
      // some of them ignore it — see the comment in the JSON for what that
      // cost. Three groups rather than one so the file still says WHY each
      // crawler is refused, which is the part a future reader needs.
      {
        userAgent: blockedCrawlers.seoTools,
        disallow: '/',
      },
      {
        userAgent: blockedCrawlers.aiTraining,
        disallow: '/',
      },
      {
        userAgent: blockedCrawlers.noReferral,
        disallow: '/',
      },
    ],
    sitemap: [`${baseUrl}/sitemap.xml`],
    host: baseUrl,
  }
}
