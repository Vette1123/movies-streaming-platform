import { defineCloudflareConfig } from '@opennextjs/cloudflare'
import kvIncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/kv-incremental-cache'
import { withRegionalCache } from '@opennextjs/cloudflare/overrides/incremental-cache/regional-cache'
import memoryQueue from '@opennextjs/cloudflare/overrides/queue/memory-queue'

// Two-tier incremental cache. ISR/prerendered pages are served from cache (a
// cheap read, no React re-render) instead of re-rendering on every request —
// that's what keeps the free-plan 10ms Worker CPU limit from being blown.
//
//   L1  Regional cache (Cloudflare Cache API, per data-center): FREE, NO QUOTA.
//       Absorbs the vast majority of reads, so KV is barely touched. `mode:
//       long-lived` keeps entries around and lazily refreshes them from KV on
//       hit — ideal for our 8h-revalidate content.
//   L2  KV (kvIncrementalCache): only hit on an L1 miss. Free-plan limits are
//       100k reads/day + 1k writes/day, but the L1 layer keeps us far under
//       them. The tag cache is left at OpenNext's default "dummy" (no-op), so
//       nothing extra hits KV.
//
// Crucially, none of this crashes on a limit: the KV override swallows every
// error (get → null → render fresh; set → drop write → keep stale entry), and
// scripts/cf-deploy.mjs tolerates a rate-limited populate step. Worst case is
// stale content or an occasional live render — never a 5xx.
export default defineCloudflareConfig({
  incrementalCache: withRegionalCache(kvIncrementalCache, { mode: 'long-lived' }),
  enableCacheInterception: true,
  queue: memoryQueue,
})
