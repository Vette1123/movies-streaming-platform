import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare'

initOpenNextCloudflareForDev()

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'image.tmdb.org',
      },
      {
        protocol: 'https',
        hostname: 'wsrv.nl',
      },
    ],
  },
  typescript: { ignoreBuildErrors: false },
  experimental: {
    optimizePackageImports: ['framer-motion', 'date-fns'],
  },
  // Override Next's default `Cache-Control: private, no-store` on public pages
  // so the Cloudflare edge cache (CDN — no KV, no quota cost) keeps a rendered
  // copy for 8h. Without this, every visit / crawl re-renders on the Worker,
  // burning the free-plan 10ms CPU budget (→ 5xx under load) and pressuring
  // TMDB. The homepage is the heaviest render, so it matters most here. Paths
  // must stay in sync with the CDN cache rule in scripts/cf-waf-setup.mjs.
  // `/watch-history` is intentionally omitted — it's personal + noindex.
  async headers() {
    const edgeCache = 'public, max-age=0, s-maxage=28800, stale-while-revalidate=86400'
    const cachedPaths = ['/', '/movies', '/tv-shows', '/movies/:id', '/tv-shows/:id']
    return cachedPaths.map((source) => ({
      source,
      headers: [{ key: 'Cache-Control', value: edgeCache }],
    }))
  },
  async redirects() {
    return [
      {
        source: '/sitemap-movies.xml',
        destination: '/sitemap.xml',
        permanent: true,
      },
      {
        source: '/sitemap-tv-shows.xml',
        destination: '/sitemap.xml',
        permanent: true,
      },
      {
        source: '/sitemap-trending.xml',
        destination: '/sitemap.xml',
        permanent: true,
      },
      {
        source: '/sitemap-static.xml',
        destination: '/sitemap.xml',
        permanent: true,
      },
      {
        source: '/server-sitemap-index.xml',
        destination: '/sitemap.xml',
        permanent: true,
      },
    ]
  },
}

export default nextConfig
