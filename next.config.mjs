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
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'reely.space' }],
        destination: 'https://www.reely.space/:path*',
        permanent: true,
      },
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
