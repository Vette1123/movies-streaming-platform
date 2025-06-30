import { defineCloudflareConfig } from '@opennextjs/cloudflare'
import kvIncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/kv-incremental-cache'

// Enhanced caching configuration for optimal Cloudflare Workers performance
// This configuration leverages KV incremental cache and cache interception for better performance
// Based on @opennextjs/cloudflare documentation: https://opennext.js.org/cloudflare
export default defineCloudflareConfig({
  // Use KV incremental cache for ISR/SSG pages - this is the core caching mechanism
  incrementalCache: kvIncrementalCache,
  
  // Enable cache interception for better performance on all routes
  // This allows OpenNext to intercept and cache responses at the edge
  enableCacheInterception: true,
})
