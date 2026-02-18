import { defineCloudflareConfig } from '@opennextjs/cloudflare'

// import staticAssetsIncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache'

// Enhanced caching configuration for optimal Cloudflare Workers performance
// This configuration leverages KV incremental cache and cache interception for better performance
// Based on @opennextjs/cloudflare documentation: https://opennext.js.org/cloudflare
export default defineCloudflareConfig({
  // incrementalCache: staticAssetsIncrementalCache,
  // enableCacheInterception: true,
  // Use KV incremental cache for ISR/SSG pages - this is the core caching mechanism
  // incrementalCache: kvIncrementalCache,
})
