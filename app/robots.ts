import type { MetadataRoute } from 'next'

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
      },
      {
        userAgent: '*',
        allow: CRAWL_ALLOW,
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
      // The one AI *search* crawler that is disallowed, and it is a crawl-rate
      // decision rather than a policy one.
      //
      // `Amzn-SearchBot` is a distinct product token from `Amazonbot` above, so
      // the training block never applied to it and it fell through to `*`.
      // Measured over 24h on 2026-08-31 it was the single largest consumer of
      // this Worker's invocation budget: 8,033 requests/day — more than
      // Claude-SearchBot (6,394), bingbot (2,631) and Googlebot (1,469) put
      // together — against a 100,000/day free-plan cap the site was already
      // using 68% of. It feeds Alexa and Amazon's own search surfaces, which
      // have sent this site no measurable referral.
      //
      // Amazon documents that none of its crawlers honour `Crawl-delay`
      // (developer.amazon.com/amazonbot), so there is no way to keep it at a
      // sane rate — the choice is all of it or none of it. The other AI search
      // crawlers stay allowed: they cite a page to a user, which is a referral.
      // Revisit if Amazon ever sends traffic back.
      {
        userAgent: 'Amzn-SearchBot',
        disallow: '/',
      },
    ],
    sitemap: [`${baseUrl}/sitemap.xml`],
    host: baseUrl,
  }
}
