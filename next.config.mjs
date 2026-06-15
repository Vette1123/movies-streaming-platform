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
    ],
  },
  typescript: { ignoreBuildErrors: false },
  experimental: {
    optimizePackageImports: ['framer-motion', 'date-fns'],
  },
  // Override Next's default `Cache-Control: private, no-store` on detail
  // routes so the Cloudflare edge cache (CDN, not KV — no quota cost) keeps
  // a rendered copy for 8h. Without this, every Googlebot crawl re-renders
  // and pressures TMDB, which surfaces as 5xx in GSC's index coverage report.
  async headers() {
    const detailCache = 'public, max-age=0, s-maxage=28800, stale-while-revalidate=86400'
    return [
      {
        source: '/movies/:id',
        headers: [{ key: 'Cache-Control', value: detailCache }],
      },
      {
        source: '/tv-shows/:id',
        headers: [{ key: 'Cache-Control', value: detailCache }],
      },
    ]
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
