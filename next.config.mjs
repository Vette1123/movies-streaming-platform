import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare'
import { withPostHogConfig } from '@posthog/nextjs-config'

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
    // Tree-shake barrel-imported libs so only the symbols actually used ship.
    // lucide-react is the big one: icons are imported per-name across ~40 files,
    // and without this the whole icon set bloats the client bundle.
    optimizePackageImports: ['framer-motion', 'lucide-react'],
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
    // Baseline security/SEO headers on every route. Deliberately conservative:
    // NO Permissions-Policy / CSP / COEP — those would risk the cross-origin
    // VidSrc player (fullscreen, autoplay) and the hero trailer embed. These
    // three are safe and lift the Lighthouse "Best Practices" score.
    const securityHeaders = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
    ]
    return [
      { source: '/:path*', headers: securityHeaders },
      ...cachedPaths.map((source) => ({
        source,
        headers: [{ key: 'Cache-Control', value: edgeCache }],
      })),
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

// Production stack traces are minified, and PostHog's symbolicator can't fetch
// our chunks to source-map them (the public assets 403 the empty-UA fetcher —
// see providers/posthog-provider.tsx). So we generate + upload source maps to
// PostHog at build time instead: withPostHogConfig injects a `//# chunkId=` into
// each emitted chunk, uploads the matching maps, then deletes them so they're
// never shipped as public Cloudflare assets. This is what makes errors like
// React #418 and the "reading 'document'" null show real file:line stacks.
//
// Gated on POSTHOG_API_KEY: without it (contributor / CI without the secret) the
// build proceeds untouched instead of failing. The host is the PostHog APP host
// (eu.posthog.com), NOT the ingestion host in NEXT_PUBLIC_POSTHOG_HOST.
const posthogApiKey = process.env.POSTHOG_API_KEY

export default posthogApiKey
  ? withPostHogConfig(nextConfig, {
      personalApiKey: posthogApiKey,
      projectId: process.env.POSTHOG_PROJECT_ID ?? '216915',
      host: process.env.POSTHOG_API_HOST ?? 'https://eu.posthog.com',
      sourcemaps: {
        // Strip the .map files after upload — the served .js keeps its chunkId
        // comment, which is all PostHog needs to symbolicate.
        deleteAfterUpload: true,
      },
    })
  : nextConfig
