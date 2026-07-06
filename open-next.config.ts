import { defineCloudflareConfig } from '@opennextjs/cloudflare'
import kvIncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/kv-incremental-cache'
import memoryQueue from '@opennextjs/cloudflare/overrides/queue/memory-queue'

// KV-backed incremental cache. ISR/prerendered pages are served from KV (a cheap
// read, no React re-render) instead of re-rendering on every request — that's
// what keeps the free-plan 10ms Worker CPU limit from being blown under load.
//
// Free-plan KV limits: 100k reads/day, 1k writes/day. This DOES NOT crash on
// limit: the KV override swallows every KV error (see kv-incremental-cache.js —
// `get` returns null on failure → the page renders fresh; `set` logs and drops
// the write → the existing entry stays). So a blown write quota just means the
// cache stops updating (stale content), and a blown read quota just means some
// requests render live — never a 5xx. `enableCacheInterception` serves cache
// hits without booting the full Next handler, shaving even more CPU.
export default defineCloudflareConfig({
  incrementalCache: kvIncrementalCache,
  enableCacheInterception: true,
  queue: memoryQueue,
})
