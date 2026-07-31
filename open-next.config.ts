import { defineCloudflareConfig } from '@opennextjs/cloudflare'
import staticAssetsIncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache'
import memoryQueue from '@opennextjs/cloudflare/overrides/queue/memory-queue'

// Prerendered pages are served straight out of Workers Static Assets. Serving
// from cache (a read, no React re-render) instead of rendering per request is
// what keeps the free-plan 10ms Worker CPU limit from being blown.
//
// This replaced a two-tier regional-cache + KV setup on 2026-07-31, after CPU
// kills climbed from 1.5% of invocations to 41% in five days. KV writes were
// running 1.1k–3.5k/day against the free plan's 1k/day cap, so populateCache
// never fully landed: `/`, `/movies` and `/tv-shows` answered `x-nextjs-cache:
// MISS` on every request, i.e. Next re-rendered a build-only page each time.
//
// populateCache copies .open-next/cache into .open-next/assets/cdn-cgi/
// _next_cache (a plain cpSync, before the asset upload in scripts/cf-deploy.mjs),
// and the override reads it back through the ASSETS binding. That path is
// worker-only, so nothing here is publicly fetchable. Reads are in-colo, free,
// and have no quota at all — no KV in the request path anymore.
//
// The trade: this store is READ-ONLY. `set`/`delete` only log, so there is no
// on-demand or time-based revalidation — a route's content changes when we
// redeploy, nothing else. That already describes this site: freshness comes
// from the 4x/day CI rebuild. `revalidate: 86400` on the detail pages still
// holds because entries carry the BUILD timestamp, and we never go 24h between
// deploys. Two things stay uncached and render live: routes outside
// generateStaticParams (`dynamicParams: true` long-tail ids) and API routes —
// /api/hero-extras has its own Cache API layer for exactly that reason.
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
  enableCacheInterception: true,
  queue: memoryQueue,
})
