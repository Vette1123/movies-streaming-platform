import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare'

initOpenNextCloudflareForDev()

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['images.unsplash.com', 'image.tmdb.org', 'plus.unsplash.com'],
    unoptimized: true,
  },
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  
  // Optimize for Cloudflare Workers
  output: 'standalone',
  
  // Custom headers for better caching
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=3600',
          },
          {
            key: 'CF-Cache-Tag',
            value: 'api-data',
          },
          {
            key: 'Vary',
            value: 'Accept-Encoding, Accept-Language',
          },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
          {
            key: 'CF-Cache-Tag',
            value: 'static-assets',
          },
        ],
      },
      {
        source: '/_next/image',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, s-maxage=2592000, stale-while-revalidate=86400',
          },
          {
            key: 'CF-Cache-Tag',
            value: 'images',
          },
        ],
      },
      {
        source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=300, s-maxage=3600, stale-while-revalidate=1800',
          },
          {
            key: 'CF-Cache-Tag',
            value: 'pages',
          },
        ],
      },
    ]
  },
}

export default nextConfig
