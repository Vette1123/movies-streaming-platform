import { defineCloudflareConfig } from '@opennextjs/cloudflare'
import memoryQueue from '@opennextjs/cloudflare/overrides/queue/memory-queue'

// No `incrementalCache` override on purpose. KV (the usual choice) caps at 1k
// writes/day on the free plan, which ISR exhausts and crashes the site. Caching
// is handled entirely at the Cloudflare edge (CDN cache rule in
// scripts/cf-waf-setup.mjs) — an edge HIT never runs the Worker, so the 10ms
// CPU limit is never hit. If persistent ISR is ever needed, use R2, not KV.
export default defineCloudflareConfig({
  enableCacheInterception: true,
  queue: memoryQueue,
})
