import { withPostHogConfig } from '@posthog/nextjs-config'

// Production is a pure static export on Cloudflare Workers: `next build` writes
// plain HTML/CSS/JS into `out/`, wrangler uploads it as Workers Static Assets,
// and the only server-side code left is cloudflare/worker.js. Next.js does not
// run in production at all.
//
// That is what fixes the free plan: static assets are matched BEFORE the Worker
// is invoked, so a page view costs zero CPU against the 10ms per-request budget
// and is exempt from the 100k requests/day cap. Under OpenNext every page view
// ran NextServer, and detail ids outside the prerendered set re-rendered React
// on every single hit — killing 25-40% of all invocations.
// See docs/superpowers/specs/2026-08-03-static-export-migration-design.md
const isStaticExport = process.env.DEPLOY_TARGET === 'cloudflare'

// `headers()` and `redirects()` are unsupported in a static export, so their
// production equivalents live in public/_headers and public/_redirects, which
// Workers Static Assets reads natively. They stay wired up here for `next dev`
// and `next start`, where those files mean nothing.
const staticExportConfig = {
  output: 'export',
}

/** @type {import('next').NextConfig} */
const baseConfig = {
  images: {
    // NOT `unoptimized: true`. That flag also suppresses `srcset`, which meant
    // every device fetched the width baked into the URL — a 2560px hero backdrop
    // on a 393px phone. A custom loader keeps srcset generation while letting
    // ImageKit do the resizing. See lib/image-loader.ts.
    loader: 'custom',
    loaderFile: './lib/image-loader.ts',
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
  // Next 16.3 appends a `<!-- BEGIN:nextjs-agent-rules -->` block to CLAUDE.md
  // on every `next dev` boot. This file is hand-maintained and the block comes
  // back after any manual removal, so a permanently dirty working tree is the
  // only other option.
  agentRules: false,
  // Drop `X-Powered-By: Next.js` — free stack fingerprint for scanners, and it
  // rides on every single response.
  poweredByHeader: false,
  experimental: {
    // Tree-shake barrel-imported libs so only the symbols actually used ship.
    // lucide-react is the big one: icons are imported per-name across ~40 files,
    // and without this the whole icon set bloats the client bundle.
    optimizePackageImports: ['framer-motion', 'lucide-react'],
  },
}

// Dev / Node-host only. A static export ignores `headers()` and `redirects()`,
// which is why the production copies live in public/_headers and
// public/_redirects — those two files and this block must say the same thing.
const serverOnlyConfig = {
  // Override Next's default `Cache-Control: private, no-store` on public pages.
  // `/watch-history` is intentionally omitted — it's personal + noindex.
  async headers() {
    const edgeCache =
      'public, max-age=0, s-maxage=21600, stale-while-revalidate=3600'
    const cachedPaths = [
      '/',
      '/movies',
      '/tv-shows',
      '/movies/:id',
      '/tv-shows/:id',
    ]
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

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...baseConfig,
  ...(isStaticExport ? staticExportConfig : serverOnlyConfig),
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
//
// ALSO gated on CI: source-map upload is a production concern (it symbolicates
// prod errors), it's slow (~2min), talks to the network, and would push
// throwaway maps for every local `pnpm build`. GitHub Actions sets CI=true, so
// the deploy uploads while local builds stay fast and offline. Force it locally
// when you actually need it with POSTHOG_UPLOAD_SOURCEMAPS=1.
const posthogApiKey = process.env.POSTHOG_API_KEY
const isCI =
  !!process.env.CI && process.env.CI !== 'false' && process.env.CI !== '0'
const shouldUploadSourcemaps =
  !!posthogApiKey && (isCI || process.env.POSTHOG_UPLOAD_SOURCEMAPS === '1')

export default shouldUploadSourcemaps
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
