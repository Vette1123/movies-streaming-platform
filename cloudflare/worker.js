/**
 * Cloudflare Worker entrypoint.
 *
 * The site is a static export. `next build` writes every prerendered page into
 * `out/`, wrangler uploads that as Workers Static Assets, and Cloudflare matches
 * an asset BEFORE this Worker is invoked — so a view of any prerendered page
 * runs no code here at all: no CPU against the 10ms budget, and no request
 * against the free plan's 100k/day cap.
 *
 * What is left is the part that genuinely cannot be static:
 *
 *   1. /api/* — the five former Server Actions plus hero-extras. They import the
 *      SAME services the build imports, so a filter result a crawler sees baked
 *      into a genre page and one a user scrolls to come from identical code.
 *   2. Detail ids outside the prerendered set. These are why this Worker exists
 *      at all: under OpenNext they re-rendered React on EVERY request (measured
 *      0.4-1.0s wall against a 10ms budget) and were killing 25-40% of all
 *      invocations. Here they cost one TMDB fetch and an HTMLRewriter pass.
 *
 * Everything both paths return is stored in `caches.default`, the per-colo Cache
 * API. That is the only cache that works on this zone: on a Workers Custom
 * Domain the Worker runs ahead of the zone cache, so a CDN cache rule can never
 * store what a Worker produced (measured — see scripts/cf-waf-setup.mjs).
 *
 * Deliberately plain JavaScript, not TypeScript: tsconfig.json covers the app,
 * and a .ts entrypoint here would be type-checked as app code while actually
 * targeting workerd. It is bundled by esbuild (scripts/build-worker.mjs), which
 * resolves the `@/…` path aliases the imported services use.
 */

import { discoverMovies, discoverSeries } from '@/services/discover'
import { fetchGenreList } from '@/services/genres'
import { getHeroExtras } from '@/services/hero-extras'
import { setImdbAssetsBinding } from '@/services/imdb'
import { getMediaSummary } from '@/services/media-summary'
import {
  getCollectionById,
  getPopularMovies,
  populateMovieDetailsPage,
} from '@/services/movies'
import { searchMedia } from '@/services/search'
import { getSeasonEpisodes } from '@/services/season-details'
import {
  getPopularSeries,
  populateSeriesDetailsPageData,
} from '@/services/series'
import { fetchWatchProviders } from '@/services/watch-providers'

import { getMediaHeroImageUrl } from '@/lib/media'
import { getImageURL } from '@/lib/utils'

/** 8h, matching the deploy cadence that refreshes the static half of the site. */
const CACHE_CONTROL = 'public, max-age=3600, s-maxage=28800'

/** A tail detail path: /movies/123 or /tv-shows/123, nothing deeper. */
const DETAIL_PATH = /^\/(movies|tv-shows)\/(\d+)\/?$/

/** A tail franchise path: /collection/123. */
const COLLECTION_PATH = /^\/collection\/(\d+)\/?$/

/**
 * The exported client shells the tail fallbacks decorate and return.
 * `trailingSlash` is false, so the export writes `media-fallback.html`, not
 * `media-fallback/index.html`.
 */
const SHELL_MEDIA = '/media-fallback.html'
const SHELL_COLLECTION = '/collection-fallback.html'

/**
 * The secrets live on the Worker, but the services read `process.env` (they are
 * the same modules Next runs at build). Copy them across on the first request.
 * Module scope is too early — bindings do not exist until a request arrives.
 */
let envCopied = false
function copyEnv(env) {
  if (envCopied) return
  for (const key of [
    'TMDB_API_KEY',
    'TMDB_HEADER_KEY',
    'NEXT_PUBLIC_TMDB_BASEURL',
    'NEXT_PUBLIC_BASE_URL',
    'NEXT_PUBLIC_IMAGE_CACHE_HOST_URL',
    'NEXT_PUBLIC_IMDB_RATINGS',
  ]) {
    if (env[key] !== undefined) process.env[key] = env[key]
  }
  envCopied = true
}

const json = (body, init = {}) =>
  Response.json(body, {
    ...init,
    headers: { 'Cache-Control': CACHE_CONTROL, ...(init.headers || {}) },
  })

/**
 * The Next build id, stamped in by scripts/build-worker.mjs.
 *
 * It namespaces every Cache API key. A fallback page is HTML that references
 * `_next/static/chunks/*` by content hash, and a deploy deletes the old hashes —
 * so an entry cached under the previous build serves a page whose scripts 404.
 * The client boundary catches that as a stale deploy and reloads, which hits the
 * same cached entry, and the page stays dead until s-maxage runs out. Keying by
 * build id makes a deploy start from an empty cache instead.
 */
const BUILD_ID = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev'

const cacheKeyUrl = (href) => {
  const url = new URL(href)
  url.searchParams.set('__b', BUILD_ID)
  return url.toString()
}

/**
 * Read-through `caches.default`.
 *
 * Both the read and the write are individually guarded: under subrequest
 * pressure `cache.match` itself can throw, and a cache failure must degrade to a
 * recompute, never to a 5xx. This is the same guard the old
 * app/api/hero-extras route carried, for the same reason.
 */
async function cached(request, ctx, compute) {
  const cache = globalThis.caches?.default
  const key = new Request(cacheKeyUrl(request.url), { method: 'GET' })

  if (cache) {
    try {
      const hit = await cache.match(key)
      if (hit) return hit
    } catch {
      // treat as a miss
    }
  }

  const response = await compute()

  if (cache && response.ok) {
    try {
      ctx.waitUntil(cache.put(key, response.clone()))
    } catch {
      // serving uncached is fine
    }
  }
  return response
}

/** Every query param except the ones the router itself consumes. */
function passthroughParams(searchParams, drop) {
  const out = {}
  for (const [key, value] of searchParams) {
    if (!drop.includes(key)) out[key] = value
  }
  return out
}

const isTv = (value) => value === 'tv'

/**
 * The detail payload for an id, or null if TMDB does not know it.
 *
 * TMDB answers an unknown id with a 404, which fetch-client raises. That is a
 * bad id, not a broken Worker — both callers turn it into a 404 of their own,
 * so it must not reach the top-level catch and become a 500.
 */
async function loadDetails(type, id) {
  try {
    return type === 'tv'
      ? await populateSeriesDetailsPageData(id)
      : await populateMovieDetailsPage(id)
  } catch {
    return null
  }
}

/**
 * Same contract as loadDetails, but only the fields the fallback HTML needs.
 * This is the cheap path — see services/media-summary.ts for why it exists.
 */
async function loadSummary(type, id) {
  try {
    return await getMediaSummary(type, id)
  } catch {
    return null
  }
}

/** Same contract as loadDetails, for a franchise id. */
async function loadCollection(id) {
  try {
    return await getCollectionById(id)
  } catch {
    return null
  }
}

async function handleApi(pathname, url, request, ctx) {
  const q = url.searchParams

  if (pathname === '/api/search') {
    const query = (q.get('query') || '').trim()
    if (!query) return json({ page: 1, results: [] })
    return cached(request, ctx, async () => json(await searchMedia({ query })))
  }

  if (pathname === '/api/filter') {
    const mediaType = isTv(q.get('mediaType')) ? 'tv' : 'movie'
    const page = Number(q.get('page')) || 1
    const filters = passthroughParams(q, ['mediaType', 'page'])
    const discover = mediaType === 'tv' ? discoverSeries : discoverMovies
    return cached(request, ctx, async () =>
      json(await discover(filters, { page }))
    )
  }

  // Page 2+ of the browse lists. Page 1 ships inside the prerendered HTML.
  if (pathname === '/api/popular') {
    const mediaType = isTv(q.get('mediaType')) ? 'tv' : 'movie'
    const page = Number(q.get('page')) || 1
    const getPopular = mediaType === 'tv' ? getPopularSeries : getPopularMovies
    return cached(request, ctx, async () => json(await getPopular({ page })))
  }

  if (pathname === '/api/genres') {
    const mediaType = isTv(q.get('mediaType')) ? 'tv' : 'movie'
    return cached(request, ctx, async () =>
      json(await fetchGenreList(mediaType))
    )
  }

  if (pathname === '/api/watch-providers') {
    const mediaType = isTv(q.get('mediaType')) ? 'tv' : 'movie'
    const region = q.get('region') || 'US'
    return cached(request, ctx, async () =>
      json(await fetchWatchProviders(mediaType, region))
    )
  }

  if (pathname === '/api/season-details') {
    const seasonId = Number(q.get('seasonId'))
    const seasonNumber = q.get('seasonNumber')
    if (!seasonId || !seasonNumber) {
      return json(
        { error: 'seasonId and seasonNumber are required' },
        { status: 400 }
      )
    }
    return cached(request, ctx, async () =>
      json(await getSeasonEpisodes(seasonId, seasonNumber))
    )
  }

  if (pathname === '/api/hero-extras') {
    const id = q.get('id')
    const type = isTv(q.get('type')) ? 'tv' : 'movie'
    if (!id || !/^\d+$/.test(id)) {
      return json({ error: 'invalid id' }, { status: 400 })
    }
    return cached(request, ctx, async () => {
      try {
        const { trailerKey, logoPath } = await getHeroExtras(type, id)
        return json({ trailerKey, logoPath })
      } catch {
        // Enrichment is non-critical — a slide works without a trailer or logo.
        // Not cached: a transient miss must not pin an empty result for 8h.
        return Response.json({ trailerKey: null, logoPath: null })
      }
    })
  }

  // Powers the tail fallback shell. Same payload shape the prerendered detail
  // pages are built from, so the client renders identical components.
  const media = pathname.match(/^\/api\/media\/(movie|tv)\/(\d+)$/)
  if (media) {
    const [, type, id] = media
    return cached(request, ctx, async () => {
      const data = await loadDetails(type, id)
      if (!data) return json({ error: 'not found' }, { status: 404 })
      return json(data)
    })
  }

  // Powers the collection fallback shell.
  const collection = pathname.match(/^\/api\/collection\/(\d+)$/)
  if (collection) {
    const [, id] = collection
    return cached(request, ctx, async () => {
      const data = await loadCollection(id)
      if (!data?.id) return json({ error: 'not found' }, { status: 404 })
      return json(data)
    })
  }

  return json({ error: 'not found' }, { status: 404 })
}

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

/**
 * Metadata for a tail id, shaped like what the prerendered page's
 * `generateMetadata` would have produced — so an unfurler cannot tell the
 * difference between a prerendered detail page and a fallback one.
 */
function buildMeta(type, id, details, siteUrl) {
  const title = details.title || details.name || 'Reely'
  const year = (details.release_date || details.first_air_date || '').slice(
    0,
    4
  )
  const heading = year ? `${title} (${year})` : title
  const description =
    (details.overview || '').slice(0, 200) ||
    `Details, cast, and streaming info for ${title} on Reely.`
  const image = getMediaHeroImageUrl(details.backdrop_path, details.poster_path)
  const canonical = `${siteUrl}/${type === 'tv' ? 'tv-shows' : 'movies'}/${id}`

  return { heading, description, image, canonical, title }
}

function metaTags({ heading, description, image, canonical }, ogType) {
  const tags = [
    `<meta name="description" content="${escapeHtml(description)}">`,
    `<link rel="canonical" href="${escapeHtml(canonical)}">`,
    `<meta property="og:type" content="${ogType}">`,
    `<meta property="og:title" content="${escapeHtml(heading)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    `<meta property="og:url" content="${escapeHtml(canonical)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escapeHtml(heading)}">`,
    `<meta name="twitter:description" content="${escapeHtml(description)}">`,
  ]
  if (image) {
    tags.push(`<meta property="og:image" content="${escapeHtml(image)}">`)
    tags.push(`<meta name="twitter:image" content="${escapeHtml(image)}">`)
  }
  return tags.join('')
}

const siteUrlOf = (url) => process.env.NEXT_PUBLIC_BASE_URL || url.origin

/** The build's own 404 page, so a made-up id gets a cheap, honest answer. */
async function notFoundAsset(env, url) {
  const notFound = await env.ASSETS.fetch(new URL('/404.html', url.origin))
  return new Response(notFound.body, {
    status: 404,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

/**
 * Take an exported client shell out of the asset store and stream it through
 * HTMLRewriter, replacing its generic head with the real title, description, OG
 * and Twitter tags, JSON-LD, and a crawlable <h1> + summary. Returns 200: these
 * are real pages, just ones the build did not have room to bake.
 */
async function serveShell(shellPath, meta, ogType, jsonLd, env, url) {
  const shell = await env.ASSETS.fetch(new URL(shellPath, url.origin))
  if (!shell.ok) {
    // The shell is part of the deploy; if it is missing the deploy is broken.
    // Fail loudly rather than serving a blank page.
    return new Response('fallback shell missing', { status: 500 })
  }

  const rewritten = new HTMLRewriter()
    .on('title', {
      element(el) {
        el.setInnerContent(meta.heading)
      },
    })
    // Strip the shell's OWN metadata first. HTMLRewriter appends to <head>,
    // so without this the generic site-level tags survive AHEAD of the ones
    // injected below — and an unfurler reads the first occurrence, which
    // means every shared tail link showed "Reely — Movie & TV Show Tracker"
    // with the default OG image instead of the title. Verified against the
    // local Worker before and after.
    .on('meta[property^="og:"]', {
      element(el) {
        el.remove()
      },
    })
    .on('meta[name^="twitter:"]', {
      element(el) {
        el.remove()
      },
    })
    .on('meta[name="description"]', {
      element(el) {
        el.remove()
      },
    })
    .on('link[rel="canonical"]', {
      element(el) {
        el.remove()
      },
    })
    .on('head', {
      element(el) {
        el.append(metaTags(meta, ogType), { html: true })
        el.append(
          `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`,
          { html: true }
        )
      },
    })
    // A crawler that does not execute JS still gets the title and synopsis.
    // Hidden from sighted users because the client render paints the real
    // page over it a moment later.
    .on('body', {
      element(el) {
        el.prepend(
          `<div hidden data-fallback-seo><h1>${escapeHtml(meta.heading)}</h1><p>${escapeHtml(meta.description)}</p></div>`,
          { html: true }
        )
      },
    })
    .transform(shell)

  return new Response(rewritten.body, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': CACHE_CONTROL,
    },
  })
}

/**
 * Serve a detail id that was not prerendered.
 *
 * Fetch the id, take the exported client shell out of the asset store, and
 * stream it through HTMLRewriter injecting the real title, description, OG and
 * Twitter tags, JSON-LD and a crawlable <h1> + overview. Returns 200: these are
 * real pages, just ones the build did not have room to bake.
 */
async function handleDetailFallback(match, request, env, ctx, url) {
  const [, segment, id] = match
  const type = segment === 'tv-shows' ? 'tv' : 'movie'

  return cached(request, ctx, async () => {
    // The SUMMARY, not the full detail payload. This path only writes meta
    // tags; it used to pull `append_to_response=credits,similar,
    // recommendations,videos` (98KB for a movie) and read six fields out of it.
    // See services/media-summary.ts. The shell fetches the full payload from
    // /api/media/:id once it boots, which is where that cost belongs.
    const details = await loadSummary(type, id)
    if (!details?.id) return notFoundAsset(env, url)

    const meta = buildMeta(type, id, details, siteUrlOf(url))
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': type === 'tv' ? 'TVSeries' : 'Movie',
      name: meta.title,
      description: meta.description,
      url: meta.canonical,
      ...(meta.image ? { image: meta.image } : {}),
    }
    const ogType = type === 'tv' ? 'video.tv_show' : 'video.movie'

    return serveShell(SHELL_MEDIA, meta, ogType, jsonLd, env, url)
  })
}

/**
 * The franchise twin of handleDetailFallback. The prerendered collection set is
 * derived from `belongs_to_collection` on prerendered movies, so the ids that
 * land here are exactly the ones a tail detail page links to.
 */
async function handleCollectionFallback(match, request, env, ctx, url) {
  const [, id] = match

  return cached(request, ctx, async () => {
    const collection = await loadCollection(id)
    if (!collection?.id) return notFoundAsset(env, url)

    const siteUrl = siteUrlOf(url)
    const description =
      collection.overview?.slice(0, 200) ||
      `Every film in the ${collection.name} on Reely.`
    const meta = {
      heading: collection.name,
      title: collection.name,
      description,
      image: collection.backdrop_path
        ? getImageURL(collection.backdrop_path)
        : '',
      canonical: `${siteUrl}/collection/${id}`,
    }
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: meta.title,
      description,
      url: meta.canonical,
      ...(meta.image ? { image: meta.image } : {}),
    }

    return serveShell(SHELL_COLLECTION, meta, 'website', jsonLd, env, url)
  })
}

export default {
  async fetch(request, env, ctx) {
    copyEnv(env)
    setImdbAssetsBinding(env.ASSETS ?? null)

    const url = new URL(request.url)
    const { pathname } = url

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return json({ error: 'method not allowed' }, { status: 405 })
    }

    try {
      if (pathname.startsWith('/api/')) {
        return await handleApi(pathname, url, request, ctx)
      }

      const detail = pathname.match(DETAIL_PATH)
      if (detail) {
        return await handleDetailFallback(detail, request, env, ctx, url)
      }

      const collection = pathname.match(COLLECTION_PATH)
      if (collection) {
        return await handleCollectionFallback(
          collection,
          request,
          env,
          ctx,
          url
        )
      }

      // Anything else that reached the Worker has no asset behind it.
      return env.ASSETS.fetch(request)
    } catch (error) {
      console.error(error)
      return json({ error: 'internal error' }, { status: 500 })
    }
  },
}
