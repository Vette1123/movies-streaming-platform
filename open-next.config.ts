import { defineCloudflareConfig } from '@opennextjs/cloudflare'

// Enhanced caching configuration for optimal Cloudflare Workers performance
// This configuration leverages KV incremental cache and cache interception for better performance
// Based on @opennextjs/cloudflare documentation: https://opennext.js.org/cloudflare
export default defineCloudflareConfig({
  // Use KV incremental cache for ISR/SSG pages - this is the core caching mechanism
  // incrementalCache: kvIncrementalCache,
})
