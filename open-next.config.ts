import { defineCloudflareConfig } from '@opennextjs/cloudflare'
import kvIncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/kv-incremental-cache'

// By default, all fetch() subrequests made in Next.js are cached with the KV namespace
// The current configuration already has NEXT_INC_CACHE_KV binding set up in wrangler.jsonc
export default defineCloudflareConfig({
  // Use KV incremental cache directly without regional cache wrapper
  incrementalCache: kvIncrementalCache,
  // Enable cache interception for better performance on ISR/SSG routes
  enableCacheInterception: true,
})
