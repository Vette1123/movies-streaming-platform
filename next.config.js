/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: true,
  },
  images: {
    domains: ['images.unsplash.com', 'image.tmdb.org', 'plus.unsplash.com'],
  },
}

module.exports = nextConfig
