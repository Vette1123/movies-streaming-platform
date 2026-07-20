import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'

import { Video } from '@/types/video'
import { fetchClient } from '@/lib/fetch-client'
import { pickLogoPath, TMDBLogo } from '@/lib/logos'
import { pickTrailerKey } from '@/lib/videos'

interface HeroExtrasResponse {
  videos?: { results: Video[] }
  images?: { logos: TMDBLogo[] }
}

// s-maxage drives the Cache API TTL below (8h), matching the TMDB ISR window.
const CACHE_CONTROL = 'public, s-maxage=28800, max-age=3600'

// This route is an API route, NOT an ISR page, so OpenNext's incremental-cache
// interception never touches it — without help it re-runs the TMDB fetch + a
// full res.json() of the big append_to_response=videos,images payload on EVERY
// request. On the free Workers plan that parse alone can blow the 10ms CPU
// budget → the runtime kills the invocation ("exceededCpu") → 503.
//
// Fix: serve repeats from the L1 regional Cache API (caches.default) — the same
// FREE, no-quota, per-datacenter cache OpenNext already leans on for pages (see
// open-next.config.ts). A hit returns the stored Response directly, skipping the
// fetch AND the parse, so CPU is near-zero. Only the first miss per colo/8h pays
// the parse. NOTE: a Worker Response's Cache-Control header is NOT honored by
// CF's edge automatically — you have to put it in the Cache API yourself, which
// is exactly what this does.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const id = searchParams.get('id')
  const type = searchParams.get('type') === 'tv' ? 'tv' : 'movie'

  if (!id || !/^\d+$/.test(id)) {
    return NextResponse.json({ error: 'invalid id' }, { status: 400 })
  }

  // `caches.default` is a Workers-runtime extension (not in the DOM CacheStorage
  // type, hence the cast) and is undefined under `next dev` (Node), so caching is
  // a prod-only fast path and dev just always computes.
  const cache = (globalThis.caches as unknown as { default?: Cache } | undefined)
    ?.default
  const cacheKey = new Request(`https://cache/hero-extras?type=${type}&id=${id}`)

  // A cache READ must never take the route down. Under subrequest pressure
  // `cache.match` itself can throw ("Too many subrequests by single Worker
  // invocation"); swallow it and fall through to compute rather than 500.
  if (cache) {
    try {
      const hit = await cache.match(cacheKey)
      if (hit) return hit
    } catch {
      // ignore — treat as a miss
    }
  }

  try {
    // include_image_language=en,null pulls English + language-neutral logos.
    const data = await fetchClient.get<HeroExtrasResponse>(
      `${type}/${id}?language=en-US&append_to_response=videos,images&include_image_language=en,null`,
      {},
      true
    )

    const body = {
      trailerKey: pickTrailerKey(data.videos?.results) ?? null,
      logoPath: pickLogoPath(data.images?.logos) ?? null,
    }

    const response = NextResponse.json(body, {
      headers: { 'Cache-Control': CACHE_CONTROL },
    })

    // Populate the regional cache without blocking the response. clone() because
    // the body returned to the client can only be read once. A cache-WRITE failure
    // must not discard the good response we just computed — guard it separately.
    if (cache) {
      try {
        getCloudflareContext().ctx.waitUntil(
          cache.put(cacheKey, response.clone())
        )
      } catch {
        // ignore — serving uncached is fine
      }
    }

    return response
  } catch {
    // Enrichment is non-critical — the slide still works without a trailer or
    // logo, so degrade quietly rather than surfacing an error. Not cached: a
    // transient miss shouldn't pin an empty result for 8h.
    return NextResponse.json({ trailerKey: null, logoPath: null })
  }
}
