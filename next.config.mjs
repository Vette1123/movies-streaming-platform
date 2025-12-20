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
  typescript: { ignoreBuildErrors: true },
}

export default nextConfig
