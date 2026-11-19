import type { MetadataRoute } from 'next'

import aiCrawlers from '@/config/ai-crawlers.json'
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
//
// The same exemption is why the manifest and the touch icons are listed. They
// are NOT dead: every page links them, and every link carries the cache-buster
// (`/site.webmanifest?v=2`, `/apple-touch-icon.png?v=2`), which is a query
// string, which `/*?*` swallows. `/favicon.ico` was already exempt and the
// others were not, so Google could fetch the search-result favicon and nothing
// else the site declares about itself. Each path below is longer than `/*?*`,
// so each wins the conflict on its own.
const CRAWL_ALLOW = [
  '/',
  '/icon',
  '/apple-icon',
  '/favicon.ico',
  '/site.webmanifest',
  '/apple-touch-icon.png',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png',
  // The data each fallback shell fetches once it boots. Every detail, list and
  // profile URL outside the prerendered set IS one of those shells, and
  // hydration resets its head to the shell's own metadata — canonical: the
  // homepage. useServedMetadata writes the real head back, but only once this
  // fetch returns, and Googlebot's renderer honours robots.txt for
  // subresources. With these under `Disallow: /api/` it never returned: ~15,000
  // tail pages went into Search Console as "Alternative page with proper
  // canonical tag", user-declared canonical https://www.reely.space/. Each is
  // longer than `/api/`, so each wins the conflict on its own; everything else
  // under /api/ stays blocked. One cached Worker invocation per render.
  '/api/media/',
  '/api/collection/',
  '/api/list/',
  '/api/profile/',
]

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
        // throttled. Applebot honours it and is why the number is here: 218
        // requests per 40 minutes on 2026-09-01, ~7,800/day, against a
        // 100,000/day invocation cap it shares with everyone else. 20 seconds
        // caps it at 4,320/day, roughly half what it was taking.
        crawlDelay: 20,
      },
      // Bing feeds DuckDuckGo and Yahoo too, so it is the second search engine
      // that matters, and it reported sitemap pages as missing. At 20 seconds a
      // full pass over the ~48,000-URL sitemap took 11 days; at 10 it is under
      // 6, and 8,640/day is still under 9% of the invocation cap.
      {
        userAgent: ['Bingbot', 'DuckDuckBot'],
        allow: CRAWL_ALLOW,
        disallow: CRAWL_DISALLOW,
        crawlDelay: 10,
      },
      // The AI knowledge crawlers (GPTBot, ClaudeBot, meta-externalagent) are
      // wanted for the pages and not for the JSON. On 2026-11-19 GPTBot alone
      // took ~7,800 Worker invocations, 4,400 of them /api/media/ payloads it
      // gets no citation from: the tail page's HTML already carries the title,
      // <h1> and JSON-LD the Worker injects. So no /api/ allow-list here, and
      // half the rate of the `*` group.
      {
        userAgent: aiCrawlers.knowledge,
        allow: CRAWL_ALLOW.filter((p) => !p.startsWith('/api/')),
        disallow: CRAWL_DISALLOW,
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
      // advertises ~48,000 URLs and prerenders ~1,000 of them, so every crawl
      // of the other ~47,000 is a Worker invocation against a 100,000/day
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
  }
}
