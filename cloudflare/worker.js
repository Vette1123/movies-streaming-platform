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

import { ownsPath, routeAccountApi } from '@/lib/api/account-router'
import { loadPublicList } from '@/lib/lists/routes'
import { getMediaHeroImageUrl } from '@/lib/media'
import { getImageURL } from '@/lib/utils'

/** 6h, matching the deploy cadence that refreshes the static half of the site. */
const CACHE_CONTROL = 'public, max-age=3600, s-maxage=21600'

/** A tail detail path: /movies/123 or /tv-shows/123, nothing deeper. */
const DETAIL_PATH = /^\/(movies|tv-shows)\/(\d+)\/?$/

/** A tail franchise path: /collection/123. */
const COLLECTION_PATH = /^\/collection\/(\d+)\/?$/

/**
 * A shared list: /l/weekend-a1b2c3.
 *
 * Same machinery as a tail detail id — a static shell decorated with real
 * metadata — for the same reason: the page has to unfurl with a title and a
 * poster in a group chat, and it cannot be prerendered because it did not exist
 * at build time.
 */
const LIST_PATH = /^\/l\/([A-Za-z0-9-]{1,64})\/?$/

/**
 * The exported client shells the tail fallbacks decorate and return.
 * `trailingSlash` is false, so the export writes `media-fallback.html`, not
 * `media-fallback/index.html`.
 */
const SHELL_MEDIA = '/media-fallback.html'
const SHELL_COLLECTION = '/collection-fallback.html'
const SHELL_LIST = '/list-fallback.html'

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
    // Accounts. All secrets, all read through `process.env` by lib/auth and
    // lib/billing for the same reason the TMDB keys are: those modules are
    // plain TypeScript that also has to run under `next dev`, where the only
    // configuration channel is the environment.
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'SESSION_TOKEN_SECRET',
    'BMC_WEBHOOK_SECRET',
    'VAPID_PUBLIC_KEY',
    'VAPID_PRIVATE_KEY',
    'VAPID_SUBJECT',
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

// Sorted, because the Cache API keys on the literal URL: `?page=2&mediaType=tv`
// and `?mediaType=tv&page=2` are the same query and were two entries, so one of
// them always paid full price. nuqs does not promise a stable param order.
const cacheKeyUrl = (href) => {
  const url = new URL(href)
  url.searchParams.set('__b', BUILD_ID)
  url.searchParams.sort()
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
async function cached(request, ctx, compute, keyHref = request.url) {
  const cache = globalThis.caches?.default
  const key = new Request(cacheKeyUrl(keyHref), { method: 'GET' })

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

/**
 * The discover params /api/filter forwards to TMDB — the keys of FilterParams
 * in types/filter.ts, minus the two the router consumes itself. Keep in sync.
 *
 * An allowlist rather than a denylist because this reads straight off the query
 * string. Anything else was forwarded verbatim to TMDB AND became part of the
 * Cache API key, so `?with_genres=28&x=1`, `&x=2`, `&x=3` were three separate
 * misses of the same result — a free-plan-quota hole that needed no more effort
 * than a loop, and cache-key noise even without one.
 */
const FILTER_PARAMS = new Set([
  'with_genres',
  'without_genres',
  'release_date.gte',
  'release_date.lte',
  'first_air_date.gte',
  'first_air_date.lte',
  'vote_average.gte',
  'vote_average.lte',
  'vote_count.gte',
  'sort_by',
  'with_runtime_gte',
  'with_runtime_lte',
  'include_adult',
  'include_video',
  'with_original_language',
  'certification',
  'certification_country',
  'with_watch_providers',
  'watch_region',
  'with_watch_monetization_types',
  'language',
])

function filterParams(searchParams) {
  const out = {}
  for (const [key, value] of searchParams) {
    if (FILTER_PARAMS.has(key)) out[key] = value
  }
  return out
}

/** TMDB refuses anything outside 1-500, so there is no reason to ask it. */
const pageParam = (value) => {
  const page = Number(value)
  if (!Number.isInteger(page) || page < 1) return 1
  return Math.min(page, 500)
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
    const page = pageParam(q.get('page'))
    const filters = filterParams(q)
    const discover = mediaType === 'tv' ? discoverSeries : discoverMovies
    return cached(request, ctx, async () =>
      json(await discover(filters, { page }))
    )
  }

  // Page 2+ of the browse lists. Page 1 ships inside the prerendered HTML.
  if (pathname === '/api/popular') {
    const mediaType = isTv(q.get('mediaType')) ? 'tv' : 'movie'
    const page = pageParam(q.get('page'))
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
    // Digits only: seasonNumber lands in a TMDB path segment and in the cache
    // key, and both should be a season number rather than whatever was typed.
    if (!seasonId || !seasonNumber || !/^\d+$/.test(seasonNumber)) {
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
    // These pages are as real as the prerendered ones — the build simply ran
    // out of room to bake them. The shell they are assembled from carries
    // `noindex, nofollow` for its own bare URL, which build-worker.mjs strips
    // out of the template precisely so this line can state the truth.
    `<meta name="robots" content="index, follow">`,
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
 * The two dynamic blocks a shell needs, shared by both render paths below so
 * they cannot drift into producing different HTML.
 */
const headBlock = (meta, ogType, jsonLd) =>
  `${metaTags(meta, ogType)}<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`

// A crawler that does not execute JS still gets the title and synopsis. Hidden
// from sighted users because the client render paints the real page over it a
// moment later.
const seoBlock = (meta) =>
  `<div hidden data-fallback-seo><h1>${escapeHtml(meta.heading)}</h1><p>${escapeHtml(meta.description)}</p></div>`

/**
 * The shells, pre-split at build time by scripts/build-worker.mjs, or null on a
 * worker-only rebuild with no export in out/ (then serveShell runs instead).
 */
const SHELL_TEMPLATES =
  typeof __SHELL_TEMPLATES__ === 'object' ? __SHELL_TEMPLATES__ : null

const encoder = new TextEncoder()

/**
 * The static chunks of a shell as bytes, encoded once per isolate.
 *
 * Lazily, per shell: a media fallback isolate should not pay to encode the
 * collection shell, and vice versa. Encoding 55 KB is cheap but it is not free,
 * and this is the path whose whole point is being cheap.
 */
const encodedShells = new Map()
function encodedShell(route) {
  const cached = encodedShells.get(route)
  if (cached) return cached

  const parts = SHELL_TEMPLATES?.[route]
  if (!parts) return null

  const encoded = {
    beforeTitle: encoder.encode(parts.beforeTitle),
    afterTitle: encoder.encode(parts.afterTitle),
    afterHead: encoder.encode(parts.afterHead),
    afterBody: encoder.encode(parts.afterBody),
  }
  encodedShells.set(route, encoded)
  return encoded
}

/**
 * Assemble a fallback page from the pre-split shell — the fast path.
 *
 * No HTML parse, no ASSETS subrequest: seven chunks queued onto a stream, four
 * of them already-encoded bytes shared by every request this isolate serves, so
 * the only per-request encoding is the title, the meta block and the SEO div.
 * Returns null when the build did not inline templates.
 */
function serveShellFromTemplate(shellPath, meta, ogType, jsonLd) {
  const parts = encodedShell(shellPath)
  if (!parts) return null

  const chunks = [
    parts.beforeTitle,
    encoder.encode(escapeHtml(meta.heading)),
    parts.afterTitle,
    encoder.encode(headBlock(meta, ogType, jsonLd)),
    parts.afterHead,
    encoder.encode(seoBlock(meta)),
    parts.afterBody,
  ]

  return new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(chunk)
        controller.close()
      },
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': CACHE_CONTROL,
      },
    }
  )
}

/**
 * Take an exported client shell out of the asset store and stream it through
 * HTMLRewriter, replacing its generic head with the real title, description, OG
 * and Twitter tags, JSON-LD, and a crawlable <h1> + summary. Returns 200: these
 * are real pages, just ones the build did not have room to bake.
 *
 * The slow path, kept for worker-only rebuilds where no export was available to
 * split. Deploys always go through build:cf, so production takes the fast path —
 * but this must keep producing byte-identical HTML, because it is the reference
 * the fast path was derived from.
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
    // Same reason as the canonical: the shell's own `noindex, nofollow` is for
    // the bare /media-fallback URL, not for the real detail page being built
    // out of it. headBlock's metaTags() appends `index, follow` after this.
    .on('meta[name="robots"]', {
      element(el) {
        el.remove()
      },
    })
    .on('head', {
      element(el) {
        el.append(headBlock(meta, ogType, jsonLd), { html: true })
      },
    })
    .on('body', {
      element(el) {
        el.prepend(seoBlock(meta), { html: true })
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

  // Cache the SUMMARY, not the assembled page.
  //
  // 99% of the ids that reach this handler are requested exactly once, by
  // crawlers walking the TMDB id space (measured: 738 fallback invocations, 729
  // distinct ids, zero from a browser-shaped UA). Storing 55 KB of HTML per id
  // was therefore ~55x the write for the same 23% hit rate, and it evicted the
  // entries that do get reused. The summary is ~1 KB, so far more ids stay
  // resident, and a hit still skips what actually costs: the TMDB round trip.
  //
  // Assembling the page from the pre-split shell afterwards is a handful of
  // string concatenations, so it is cheaper to redo than to store.
  const summary = await cached(
    request,
    ctx,
    async () => {
      // The SUMMARY, not the full detail payload. This path only writes meta
      // tags; it used to pull `append_to_response=credits,similar,
      // recommendations,videos` (98KB for a movie) and read six fields out of
      // it. See services/media-summary.ts. The shell fetches the full payload
      // from /api/media/:id once it boots, which is where that cost belongs.
      const details = await loadSummary(type, id)
      // A 404 keeps `cached` from storing it: an id TMDB does not know must not
      // be pinned for 8h on the strength of one possibly-transient failure.
      if (!details?.id) return json({ error: 'not found' }, { status: 404 })
      return json(details)
    },
    `${url.origin}/__summary/${type}/${id}`
  )

  if (!summary.ok) return notFoundAsset(env, url)
  const details = await summary.json()

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

  return (
    serveShellFromTemplate(SHELL_MEDIA, meta, ogType, jsonLd) ??
    serveShell(SHELL_MEDIA, meta, ogType, jsonLd, env, url)
  )
}

/**
 * The franchise twin of handleDetailFallback. The prerendered collection set is
 * derived from `belongs_to_collection` on prerendered movies, so the ids that
 * land here are exactly the ones a tail detail page links to.
 */
async function handleCollectionFallback(match, request, env, ctx, url) {
  const [, id] = match

  // Same shape as handleDetailFallback: cache the TMDB payload under its own
  // key, assemble the page fresh. See the note there.
  const cachedCollection = await cached(
    request,
    ctx,
    async () => {
      const data = await loadCollection(id)
      if (!data?.id) return json({ error: 'not found' }, { status: 404 })
      return json(data)
    },
    `${url.origin}/__summary/collection/${id}`
  )

  if (!cachedCollection.ok) return notFoundAsset(env, url)
  const collection = await cachedCollection.json()

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

  return (
    serveShellFromTemplate(SHELL_COLLECTION, meta, 'website', jsonLd) ??
    serveShell(SHELL_COLLECTION, meta, 'website', jsonLd, env, url)
  )
}

/**
 * A published list at /l/<slug>.
 *
 * Deliberately NOT stored in `caches.default`: unpublishing has to take the page
 * down at once, and a cached copy would keep serving someone else's list for the
 * rest of its TTL. The read behind it is one indexed D1 lookup, which is I/O and
 * costs no CPU, so there is very little to cache anyway.
 */
async function handleListPage(match, env, url) {
  const [, slug] = match
  const db = env.DB
  if (!db) return notFoundAsset(env, url)

  const list = await loadPublicList(db, slug)
  if (!list) return notFoundAsset(env, url)

  const siteUrl = siteUrlOf(url)
  const count = list.items.length
  const owner = list.owner ? ` by ${list.owner}` : ''
  const meta = {
    heading: list.name,
    title: list.name,
    description:
      list.description ||
      `${count} ${count === 1 ? 'title' : 'titles'}${owner} on Reely.`,
    // The first poster is the list's face. `getImageURL` is the same helper the
    // rest of the site builds image URLs with, so a shared link and the page it
    // opens show the same artwork.
    image: list.items[0]?.poster_path
      ? getImageURL(list.items[0].poster_path)
      : '',
    canonical: `${siteUrl}/l/${slug}`,
  }
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: list.name,
    description: meta.description,
    url: meta.canonical,
    numberOfItems: count,
    itemListElement: list.items.slice(0, 20).map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.title,
      url: `${siteUrl}/${item.type === 'series' ? 'tv-shows' : 'movies'}/${item.id}`,
    })),
  }

  return (
    serveShellFromTemplate(SHELL_LIST, meta, 'website', jsonLd) ??
    serveShell(SHELL_LIST, meta, 'website', jsonLd, env, url)
  )
}

export default {
  /**
   * The hourly sweep for new-episode alerts. Imported lazily so its TMDB and
   * push code is evaluated only in the isolate that actually runs a cron tick,
   * never in one serving requests.
   */
  async scheduled(event, env, ctx) {
    copyEnv(env)
    if (!env.DB) return
    const { runSweep } = await import('@/lib/push/sweep')
    ctx.waitUntil(
      runSweep(env.DB, Date.now())
        .then((result) => console.log('sweep', JSON.stringify(result)))
        .catch((error) => console.error('sweep failed', String(error)))
    )
  },

  async fetch(request, env, ctx) {
    copyEnv(env)
    setImdbAssetsBinding(env.ASSETS ?? null)

    const url = new URL(request.url)
    const { pathname } = url

    // Before the method check below: every mutating account route is a POST,
    // and this dispatcher does its own per-path method table.
    if (ownsPath(pathname)) {
      try {
        const response = await routeAccountApi(pathname, request, env, ctx)
        if (response) return response
      } catch (error) {
        console.error('account route failed', String(error))
        // Not the `json` helper above: that one stamps the site's shared
        // Cache-Control on everything it returns, and a per-session failure must
        // never be storable by any cache.
        return new Response(
          JSON.stringify({ success: false, error: 'internal error' }),
          {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'private, no-store',
            },
          }
        )
      }
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return json({ error: 'method not allowed' }, { status: 405 })
    }

    try {
      if (pathname.startsWith('/api/')) {
        return await handleApi(pathname, url, request, ctx)
      }

      const list = pathname.match(LIST_PATH)
      if (list) {
        return await handleListPage(list, env, url)
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

      // Anything else that reached the Worker has no asset behind it — assets
      // match first, so getting here means nothing in out/ answers this path.
      //
      // Serve the build's own 404 page rather than handing the request back to
      // ASSETS. With `not_found_handling: "none"` (which wrangler.jsonc has to
      // keep, or unmatched detail ids would get 404.html instead of reaching the
      // fallback renderer above), ASSETS answers an unmatched path with a bare
      // `404 Content-Length: 0` — so every mistyped or dead URL on the site
      // rendered as a blank white page. Same helper the tail-id paths already
      // use for a made-up id.
      return await notFoundAsset(env, url)
    } catch (error) {
      console.error(error)
      return json({ error: 'internal error' }, { status: 500 })
    }
  },
}
