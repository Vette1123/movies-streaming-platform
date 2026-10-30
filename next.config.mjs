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
    // wsrv.nl do the resizing. See lib/image-loader.ts.
    loader: 'custom',
    loaderFile: './lib/image-loader.ts',
    // Next 15.4+ only lets `quality` take values declared here, and rejects the
    // rest at build time — a custom loader is no exception, since the check runs
    // in next/image before the loader is ever called. These are the two
    // components/blurred-image.tsx sets (65 backdrops / 70 posters) plus Next's
    // own 75 default, which is what anything not going through BlurredImage
    // still asks for.
    qualities: [65, 70, 75],
    // Next's list plus 320: what a 160px rail poster needs at dpr 1.75-2, which
    // 256 under-serves and 384 overpays for by 40%. Keep CANDIDATE_WIDTHS in
    // lib/image-loader.ts in step.
    imageSizes: [32, 48, 64, 96, 128, 256, 320, 384],
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
  // The sitemap route is one page that makes ~1,800 TMDB reads: it harvests the
  // similar/recommended ids every detail page links to, so the pages the site
  // points at are advertised (see lib/media-page.ts buildLinkedMediaIds).
  // Measured on a cold fetch cache it lands either side of Next's 60s default,
  // which turns a good build into "Failed to build /sitemap.xml (attempt 1 of
  // 3)" and a retry — and on a slow network into a failed deploy. Nothing else
  // in the build comes close to this, so the ceiling is generous on purpose.
  staticPageGenerationTimeout: 300,
  experimental: {
    // Not `inlineCss`, measured: it writes the stylesheet into every document, its
    // flight data and the Worker's four inlined shells, taking the Worker from
    // 472KB to 2.8MB and every page's HTML up by 500KB.
    // Tree-shake barrel-imported libs so only the symbols actually used ship.
    // lucide-react is the big one: icons are imported per-name across ~40 files,
    // and without this the whole icon set bloats the client bundle.
    optimizePackageImports: ['framer-motion', 'lucide-react'],
    // The project is on TypeScript 7, whose package has no JS compiler API for
    // Next's in-process checker; without this `next dev` and `next build`
    // refuse to start. The build's type check runs `tsc` instead (the native
    // 7.x one). The linter keeps its own TypeScript 6 — see .pnpmfile.cjs.
    useTypeScriptCli: true,
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

// The clock "New" badges are judged against (components/new-badge-when-recent.tsx).
// One value per build, shared by the prerendered HTML and the client bundle,
// so the badge can render on the server without a hydration mismatch. `??=`
// pins it in process.env before Next forks its render workers, which inherit
// it — re-reading Date.now() per worker would let two pages disagree.
process.env.NEXT_PUBLIC_BUILD_TIME ??= String(Date.now())

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
