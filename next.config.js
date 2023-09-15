/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: true,
  },
  images: {
    domains: ['images.unsplash.com', 'image.tmdb.org', 'plus.unsplash.com'],
    // unoptimized: true,
  },
}

module.exports = nextConfig
