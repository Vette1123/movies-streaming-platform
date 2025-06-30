import queryString from 'query-string'
import { revalidateTag } from 'next/cache'

import { apiConfig } from '@/lib/tmdbConfig'

// Cache configuration optimized for Cloudflare Workers
const CACHE_CONFIG = {
  // Popular/trending data - changes frequently
  DYNAMIC: {
    revalidate: 3600, // 1 hour
    tags: ['tmdb-dynamic'],
    cacheControl: 'public, max-age=1800, s-maxage=3600, stale-while-revalidate=1800',
  },
  // Movie/series details - semi-static
  DETAILS: {
    revalidate: 28800, // 8 hours
    tags: ['tmdb-details'],
    cacheControl: 'public, max-age=14400, s-maxage=28800, stale-while-revalidate=7200',
  },
  // Search results - short-lived
  SEARCH: {
    revalidate: 1800, // 30 minutes
    tags: ['tmdb-search'],
    cacheControl: 'public, max-age=900, s-maxage=1800, stale-while-revalidate=900',
  },
  // Static data - rarely changes
  STATIC: {
    revalidate: 86400, // 24 hours
    tags: ['tmdb-static'],
    cacheControl: 'public, max-age=43200, s-maxage=86400, stale-while-revalidate=21600',
  },
}

// Determine cache type based on URL patterns
const getCacheType = (url: string): keyof typeof CACHE_CONFIG => {
  if (url.includes('/search/')) return 'SEARCH'
  if (url.includes('/movie/') || url.includes('/tv/')) {
    // Individual movie/tv details
    if (url.match(/\/(movie|tv)\/\d+$/)) return 'DETAILS'
    // Related content (similar, recommendations, credits)
    if (url.includes('/similar') || url.includes('/recommendations') || url.includes('/credits')) {
      return 'DETAILS'
    }
  }
  // Popular, trending, top-rated lists
  if (url.includes('/trending/') || url.includes('/popular') || url.includes('/top_rated')) {
    return 'DYNAMIC'
  }
  return 'STATIC'
}

// Generate cache key for consistent caching
const generateCacheKey = (url: string, params?: Record<string, string | number>): string => {
  const sortedParams = params ? 
    Object.keys(params)
      .sort()
      .reduce((acc, key) => ({ ...acc, [key]: params[key] }), {}) 
    : {}
  
  const queryString = Object.keys(sortedParams).length > 0 
    ? `?${new URLSearchParams(sortedParams as Record<string, string>).toString()}`
    : ''
  
  return `tmdb:${url}${queryString}`
}

export const fetchClient = {
  get: async <T>(
    url: string,
    params?: Record<string, string | number>,
    isHeaderAuth = false
  ): Promise<T> => {
    const query = {
      ...params,
      ...(!isHeaderAuth && { api_key: apiConfig.apiKey! }),
    }

    const cacheType = getCacheType(url)
    const cacheConfig = CACHE_CONFIG[cacheType]
    const cacheKey = generateCacheKey(url, query)

    try {
      const res = await fetch(
        `${apiConfig.baseUrl}${queryString.stringifyUrl({ url, query })}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': cacheConfig.cacheControl,
            'CF-Cache-Tag': cacheConfig.tags.join(','),
            'X-Cache-Key': cacheKey,
            ...(isHeaderAuth && {
              Authorization: `Bearer ${apiConfig.headerKey}`,
            }),
          },
          // Next.js caching with optimized revalidation
          next: { 
            revalidate: cacheConfig.revalidate,
            tags: [...cacheConfig.tags, cacheKey],
          },
        }
      )

      if (!res.ok) {
        throw new Error(`TMDB API error: ${res.status} ${res.statusText}`)
      }

      const data = await res.json()
      
      // Log cache strategy for debugging
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Cache] ${cacheType} strategy for ${cacheKey}`)
      }

      return data
    } catch (error: any) {
      console.error(`[Fetch Error] ${cacheKey}:`, error.message)
      throw error
    }
  },

  post: async <T>(url: string, body = {}): Promise<T> => {
    try {
      const res = await fetch(`${apiConfig.baseUrl}${url}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiConfig.apiKey}`,
          'Cache-Control': 'no-cache',
        },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        throw new Error(`TMDB API POST error: ${res.status} ${res.statusText}`)
      }

      return await res.json()
    } catch (error: any) {
      console.error(`[POST Error] ${url}:`, error.message)
      throw error
    }
  },

  // Utility to purge cache by tags (for use with Cloudflare)
  purgeCache: async (tags: string[]): Promise<void> => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Cache Purge] Would purge tags: ${tags.join(', ')}`)
      return
    }

    // In production, this would integrate with Cloudflare's cache purge API
    // For now, we'll use Next.js revalidateTag if available
    if (typeof revalidateTag !== 'undefined') {
      tags.forEach(tag => {
        try {
          revalidateTag(tag)
        } catch (error) {
          console.warn(`[Cache Purge] Failed to purge tag ${tag}:`, error)
        }
      })
    }
  },

  // Preload critical data for cache warming
  preloadCriticalData: async (): Promise<void> => {
    const criticalEndpoints = [
      { url: 'movie/popular', params: { page: 1 } },
      { url: 'tv/popular', params: { page: 1 } },
      { url: 'trending/movie/day', params: { page: 1 } },
      { url: 'trending/tv/day', params: { page: 1 } },
    ]

    console.log('[Cache Warm] Starting critical data preload...')
    
    const preloadPromises = criticalEndpoints.map(async ({ url, params }) => {
      try {
        await fetchClient.get(url, params, true)
        console.log(`[Cache Warm] Preloaded: ${url}`)
      } catch (error) {
        console.warn(`[Cache Warm] Failed to preload ${url}:`, error)
      }
    })
    
    await Promise.allSettled(preloadPromises)
    console.log('[Cache Warm] Critical data preload completed')
  },
}
