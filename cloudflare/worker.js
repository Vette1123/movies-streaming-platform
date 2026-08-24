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
import { getReels } from '@/services/reels'
import { searchMedia } from '@/services/search'
import { getSeasonEpisodes } from '@/services/season-details'
import {
  getPopularSeries,
  populateSeriesDetailsPageData,
} from '@/services/series'
import { fetchWatchProviders } from '@/services/watch-providers'

import { ownsPath } from '@/lib/api/account-paths'
import { loadSession, sessionCookieOf } from '@/lib/auth/session'
import { isEntitled } from '@/lib/billing/entitlement'
import { loadDirectory } from '@/lib/community/routes'
import { smartQuery } from '@/lib/filter-query'
import { loadPublicList } from '@/lib/lists/routes'
import { getMediaHeroImageUrl } from '@/lib/media'
import { mosaicUrl, OG_HEIGHT, OG_WIDTH } from '@/lib/og/mosaic'
import { signEntryTicket } from '@/lib/pro/playback-ticket'
import { loadPublicProfile } from '@/lib/profile/routes'
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
const SHELL_PROFILE = '/profile-fallback.html'
/**
 * The directory shell is not a fallback at all — it is the real exported
 * /lists page, which the Worker decorates in place (see handleListsDirectory).
 */
const SHELL_LISTS = '/lists.html'

/**
 * A public profile: /u/gado.
 *
 * Same shape as the list above, for the same reason: the page is a person
 * sharing themselves, so it has to unfurl properly wherever it is pasted, and
 * it cannot be prerendered because the handle did not exist at build time. The
 * pattern matches exactly what normaliseHandle accepts, so a request that could
 * never be a handle never reaches the database.
 */
const PROFILE_PATH = /^\/u\/([a-z0-9-]{3,20})\/?$/

/**
 * The public directory.
 *
 * Unlike every other path here this one IS a prerendered page — it is in
 * `run_worker_first` so the Worker can write the directory's links into it
 * before it goes out. See handleListsDirectory.
 */
const LISTS_PATH = /^\/lists\/?$/

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
    // Private playback worker. Not a secret — a URL, kept out of the repo by
    // the same discipline as the embed providers (see config/sources.ts).
    // The ticket secret itself stays out of process.env entirely: the ticket
    // route reads it straight off `env.PLAYBACK_TICKET_SECRET`.
    'PLAYBACK_WORKER_URL',
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
 * The same JSON, explicitly NOT cacheable. Every route that reads live room
 * state has to use this.
 *
 * `CACHE_CONTROL` is right for TMDB reads and catastrophic for a poll: it puts
 * the answer in the BROWSER's cache for an hour, so the client's fetch never
 * leaves the machine and the room appears frozen. Measured 2026-08-23 - Match
 * Night's four-second poll fired on schedule and returned the same empty
 * payload every time, while curl (which has no cache) showed the match. That is
 * exactly why "verified by curl" was not verification.
 */
const liveJson = (body, init = {}) =>
  json(body, { ...init, headers: { 'Cache-Control': 'no-store' } })

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
//
// The no-query case skips the URL round trip. That is not a micro-optimisation
// looking for a home: it is the branch the tail-id fallback takes, which is 96%
// of this Worker's invocations, and parsing plus re-serialising a URL to append
// one fixed parameter is work with no question behind it. A given href always
// takes the same branch, so the two cannot disagree about a key.
const cacheKeyUrl = (href) => {
  if (!href.includes('?')) return `${href}?__b=${BUILD_ID}`
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
 * `cached`, for the two callers that want the object rather than the response.
 *
 * Both fallback pages need the payload's fields to build meta tags, and both
 * used to get them by serialising what they had just computed into a Response,
 * handing it to `cached`, and then parsing that same Response straight back —
 * a stringify and a parse of something already in hand, on every cache miss.
 * On a hit there is no way around parsing, because a hit is bytes.
 *
 * Returns null for "no such id", which both callers turn into the 404 asset.
 */
async function cachedJson(request, ctx, compute, keyHref) {
  let computed
  const response = await cached(
    request,
    ctx,
    async () => {
      computed = await compute()
      // A 404 keeps `cached` from storing it: an id TMDB does not know must not
      // be pinned for 8h on the strength of one possibly-transient failure.
      if (!computed?.id) return json({ error: 'not found' }, { status: 404 })
      return json(computed)
    },
    keyHref
  )

  if (!response.ok) return null
  return computed ?? (await response.json())
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
 * A party code humans can read aloud: 6 unambiguous characters, no 0/O/1/I.
 * 32^6 is over a billion rooms - collisions are swept up by the primary-key
 * constraint, and a retry is one line away (not needed at this volume).
 */
const ROOM_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
const roomCode = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  return Array.from(bytes, (b) => ROOM_ALPHABET[b % ROOM_ALPHABET.length]).join(
    ''
  )
}

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

/**
 * The cache key for an /api/* answer: the route plus the values it actually
 * used, and nothing else.
 *
 * `cached()` otherwise keys on the raw request URL, which means anything on the
 * query string is part of the key — including the parameters FILTER_PARAMS
 * already refuses to forward to TMDB. `?with_genres=28&x=1`, `&x=2`, `&x=3`
 * were three separate misses of one identical result: three TMDB round trips,
 * three JSON parses, and three entries evicting real ones. The allowlist closed
 * that hole for the upstream request and left it open for the cache.
 *
 * It also collapses the honest duplicates: a different parameter order, a page
 * written `01`, a search typed with a different capitalisation.
 */
const apiKey = (url, params) => {
  const key = new URL(url.pathname, url.origin)
  for (const [name, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue
    key.searchParams.set(name, String(value))
  }
  return key.toString()
}

async function handleApi(pathname, url, request, ctx, env) {
  const q = url.searchParams

  // Reely Reels — the trailer feed. One batch per trending page; the client
  // scrolls, the cursor is just the TMDB page number.
  if (pathname === '/api/reels') {
    const page = pageParam(q.get('page'))
    return cached(
      request,
      ctx,
      async () => json(await getReels(page)),
      apiKey(url, { page })
    )
  }

  if (pathname === '/api/search') {
    const query = (q.get('query') || '').trim()
    if (!query) return json({ page: 1, results: [] })
    return cached(
      request,
      ctx,
      async () => json(await searchMedia({ query })),
      // Lower-cased in the KEY only — TMDB's search is case-insensitive, so
      // "Batman" and "batman" are one answer that used to be cached twice.
      apiKey(url, { query: query.toLowerCase() })
    )
  }

  if (pathname === '/api/filter') {
    const mediaType = isTv(q.get('mediaType')) ? 'tv' : 'movie'
    const page = pageParam(q.get('page'))
    const filters = filterParams(q)
    const discover = mediaType === 'tv' ? discoverSeries : discoverMovies
    return cached(
      request,
      ctx,
      async () => json(await discover(filters, { page })),
      apiKey(url, { ...filters, mediaType, page })
    )
  }

  // Page 2+ of the browse lists. Page 1 ships inside the prerendered HTML.
  if (pathname === '/api/popular') {
    const mediaType = isTv(q.get('mediaType')) ? 'tv' : 'movie'
    const page = pageParam(q.get('page'))
    const getPopular = mediaType === 'tv' ? getPopularSeries : getPopularMovies
    return cached(
      request,
      ctx,
      async () => json(await getPopular({ page })),
      apiKey(url, { mediaType, page })
    )
  }

  if (pathname === '/api/genres') {
    const mediaType = isTv(q.get('mediaType')) ? 'tv' : 'movie'
    return cached(
      request,
      ctx,
      async () => json(await fetchGenreList(mediaType)),
      apiKey(url, { mediaType })
    )
  }

  if (pathname === '/api/watch-providers') {
    const mediaType = isTv(q.get('mediaType')) ? 'tv' : 'movie'
    const region = q.get('region') || 'US'
    return cached(
      request,
      ctx,
      async () => json(await fetchWatchProviders(mediaType, region)),
      apiKey(url, { mediaType, region })
    )
  }

  // ---- Match Night + Watch Together --------------------------------------
  // Ephemeral D1 rooms, no TMDB traffic, no auth - a party code is the whole
  // credential. Both features sweep their own dead rooms on every create, so
  // nothing accumulates on the free plan.

  if (pathname === '/api/match/room' && request.method === 'POST') {
    const db = env.DB
    if (!db) return liveJson({ error: 'unavailable' }, { status: 503 })
    const now = Date.now()
    // Sweep: rooms die after 12h; the index on created_at is not worth it at
    // this scale - a full scan of a table that holds hours of rooms is free.
    await db
      .prepare('DELETE FROM match_rooms WHERE created_at < ?')
      .bind(now - 12 * 3600 * 1000)
      .run()
    await db
      .prepare('DELETE FROM match_swipes WHERE created_at < ?')
      .bind(now - 12 * 3600 * 1000)
      .run()
    const code = roomCode()
    await db
      .prepare('INSERT INTO match_rooms (code, created_at) VALUES (?, ?)')
      .bind(code, now)
      .run()
    return liveJson({ code })
  }

  if (pathname === '/api/match/swipe' && request.method === 'POST') {
    const db = env.DB
    if (!db) return liveJson({ error: 'unavailable' }, { status: 503 })
    const body = await request.json().catch(() => null)
    const { code, swiper, mediaId, mediaType, liked } = body ?? {}
    if (
      !code ||
      !swiper ||
      !Number.isInteger(mediaId) ||
      (mediaType !== 'movie' && mediaType !== 'tv') ||
      typeof liked !== 'boolean'
    ) {
      return liveJson(
        { error: 'code, swiper, mediaId, mediaType, liked' },
        { status: 400 }
      )
    }
    // Upsert, last verdict wins. DO NOTHING froze the first swipe forever,
    // which made the client's undo a lie: the card came back on screen while
    // the like it had already recorded stayed in the room and could still
    // light up as a match.
    await db
      .prepare(
        `INSERT INTO match_swipes (room_code, swiper, media_id, media_type, liked, created_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (room_code, swiper, media_id)
         DO UPDATE SET liked = excluded.liked, created_at = excluded.created_at`
      )
      .bind(
        String(code),
        String(swiper).slice(0, 64),
        mediaId,
        mediaType,
        liked ? 1 : 0,
        Date.now()
      )
      .run()
    return liveJson({ ok: true })
  }

  if (pathname === '/api/match/matches') {
    const db = env.DB
    if (!db) return liveJson({ error: 'unavailable' }, { status: 503 })
    const code = q.get('code')
    if (!code) return liveJson({ error: 'code required' }, { status: 400 })
    // A match is two liked rows for the same media from two different
    // swipers - derived, never stored, so it can not drift.
    // One round trip, two answers: the matches themselves, and how many people
    // have swiped in this room at all. The client needs the second to tell
    // 'nobody has joined yet' apart from 'you two disagree on everything' - one
    // without the other says the same nothing in both cases.
    const [hits, party] = await db.batch([
      db
        .prepare(
          `SELECT media_id, media_type, COUNT(DISTINCT swiper) AS likers
           FROM match_swipes
           WHERE room_code = ? AND liked = 1
           GROUP BY media_id, media_type
           HAVING likers >= 2`
        )
        .bind(code),
      db
        .prepare(
          'SELECT COUNT(DISTINCT swiper) AS swipers FROM match_swipes WHERE room_code = ?'
        )
        .bind(code),
    ])
    return liveJson({
      matches: hits.results ?? [],
      swipers: party.results?.[0]?.swipers ?? 0,
    })
  }

  if (pathname === '/api/together/room' && request.method === 'POST') {
    const db = env.DB
    if (!db) return liveJson({ error: 'unavailable' }, { status: 503 })
    const now = Date.now()
    await db
      .prepare('DELETE FROM together_beats WHERE updated_at < ?')
      .bind(now - 6 * 3600 * 1000)
      .run()
    const code = roomCode()
    await db
      .prepare(
        'INSERT INTO together_beats (code, position, playing, updated_at) VALUES (?, 0, 0, ?)'
      )
      .bind(code, now)
      .run()
    return liveJson({ code })
  }

  if (pathname === '/api/together/beat' && request.method === 'POST') {
    const db = env.DB
    if (!db) return liveJson({ error: 'unavailable' }, { status: 503 })
    const body = await request.json().catch(() => null)
    const { code, position, playing } = body ?? {}
    if (!code || typeof position !== 'number' || typeof playing !== 'boolean') {
      return liveJson({ error: 'code, position, playing' }, { status: 400 })
    }
    await db
      .prepare(
        `INSERT INTO together_beats (code, position, playing, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT (code) DO UPDATE SET position = excluded.position, playing = excluded.playing, updated_at = excluded.updated_at`
      )
      .bind(String(code), Math.max(0, position), playing ? 1 : 0, Date.now())
      .run()
    return liveJson({ ok: true })
  }

  if (pathname === '/api/together/state') {
    const db = env.DB
    if (!db) return liveJson({ error: 'unavailable' }, { status: 503 })
    const code = q.get('code')
    if (!code) return liveJson({ error: 'code required' }, { status: 400 })
    const beat = await db
      .prepare(
        'SELECT position, playing, updated_at FROM together_beats WHERE code = ?'
      )
      .bind(code)
      .first()
    if (!beat) return liveJson({ error: 'room not found' }, { status: 404 })
    return liveJson(beat)
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
    return cached(
      request,
      ctx,
      async () => json(await getSeasonEpisodes(seasonId, seasonNumber)),
      apiKey(url, { seasonId, seasonNumber: Number(seasonNumber) })
    )
  }

  if (pathname === '/api/hero-extras') {
    const id = q.get('id')
    const type = isTv(q.get('type')) ? 'tv' : 'movie'
    if (!id || !/^\d+$/.test(id)) {
      return json({ error: 'invalid id' }, { status: 400 })
    }
    return cached(
      request,
      ctx,
      async () => {
        try {
          const { trailerKey, logoPath } = await getHeroExtras(type, id)
          return json({ trailerKey, logoPath })
        } catch {
          // Enrichment is non-critical — a slide works without a trailer or
          // logo. Not cached: a transient miss must not pin an empty result
          // for 8h.
          return Response.json({ trailerKey: null, logoPath: null })
        }
      },
      apiKey(url, { id, type })
    )
  }

  // Powers the tail fallback shell. Same payload shape the prerendered detail
  // pages are built from, so the client renders identical components.
  const media = pathname.match(/^\/api\/media\/(movie|tv)\/(\d+)$/)
  if (media) {
    const [, type, id] = media
    return cached(
      request,
      ctx,
      async () => {
        const data = await loadDetails(type, id)
        if (!data) return json({ error: 'not found' }, { status: 404 })
        return json(data)
      },
      // No parameters, so the key is the path — which also drops any query
      // string appended to it. This is the route it matters most on: it is the
      // most expensive one the Worker serves.
      apiKey(url, {})
    )
  }

  // Powers the collection fallback shell.
  const collection = pathname.match(/^\/api\/collection\/(\d+)$/)
  if (collection) {
    const [, id] = collection
    return cached(
      request,
      ctx,
      async () => {
        const data = await loadCollection(id)
        if (!data?.id) return json({ error: 'not found' }, { status: 404 })
        return json(data)
      },
      apiKey(url, {})
    )
  }

  return json({ error: 'not found' }, { status: 404 })
}

// One pass, not four. Identical output to the chained `.replace()` calls this
// replaces — `&` is still handled first, because a single scan can never
// re-escape an entity it just wrote. Every fallback page calls this on its
// heading and description twice each, plus once per link in the directory, and
// the fallback path is 96% of this Worker's invocations.
const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }
const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"]/g, (char) => HTML_ESCAPES[char])

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

function metaTags(
  { heading, description, image, imageWidth, imageHeight, canonical },
  ogType
) {
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
  // Only ever set for the composed mosaic, whose size we know exactly. Stating
  // it lets an unfurler lay the card out before the image lands — and stating
  // it wrongly for a poster of unknown dimensions would be worse than silence.
  if (image && imageWidth && imageHeight) {
    tags.push(`<meta property="og:image:width" content="${imageWidth}">`)
    tags.push(`<meta property="og:image:height" content="${imageHeight}">`)
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
  `<div hidden data-fallback-seo><h1>${escapeHtml(meta.heading)}</h1><p>${escapeHtml(meta.description)}</p>${linkBlock(meta.links)}</div>`

/**
 * The directory's own links, for a crawler that never runs the fetch.
 *
 * `/lists` indexes rows written after the build, so without this the only thing
 * a crawler can see on it is a heading — and every published list stays
 * unreachable except by someone pasting the URL. Real anchors, in the document,
 * on the first byte.
 */
const linkBlock = (links) =>
  Array.isArray(links) && links.length > 0
    ? `<ul>${links
        .map(
          (link) =>
            `<li><a href="${escapeHtml(link.href)}">${escapeHtml(link.text)}</a></li>`
        )
        .join('')}</ul>`
    : ''

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
  const details = await cachedJson(
    request,
    ctx,
    // The SUMMARY, not the full detail payload. This path only writes meta
    // tags; it used to pull `append_to_response=credits,similar,
    // recommendations,videos` (98KB for a movie) and read six fields out of
    // it. See services/media-summary.ts. The shell fetches the full payload
    // from /api/media/:id once it boots, which is where that cost belongs.
    () => loadSummary(type, id),
    `${url.origin}/__summary/${type}/${id}`
  )

  if (!details) return notFoundAsset(env, url)

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
  const collection = await cachedJson(
    request,
    ctx,
    () => loadCollection(id),
    `${url.origin}/__summary/collection/${id}`
  )

  if (!collection) return notFoundAsset(env, url)

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
 * The titles a smart list currently resolves to, in the shape the page's
 * metadata expects. An empty array on any failure: a list whose filter TMDB
 * cannot answer right now is still a page, and it must not 500.
 */
async function resolveSmartList(query) {
  try {
    const { mediaType, params } = smartQuery(query)
    const discover = mediaType === 'tv' ? discoverSeries : discoverMovies
    const page = await discover(params, { page: 1 })
    return (page.results ?? []).slice(0, 20).map((result) => ({
      id: result.id,
      type: mediaType === 'tv' ? 'series' : 'movie',
      title: result.title || result.name || 'Untitled',
      poster_path: result.poster_path ?? null,
    }))
  } catch {
    return []
  }
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
  // A smart list holds a filter, not titles, so the ones to name in the unfurl
  // and the ItemList have to be fetched. One discover call — the same one the
  // browse pages make, through the same governed client — and only for a smart
  // list; an ordinary one still costs zero TMDB traffic.
  const items = list.smart_query
    ? await resolveSmartList(list.smart_query)
    : list.items
  const count = items.length
  const owner = list.owner ? ` by ${list.owner}` : ''
  const shelf = `${count} ${count === 1 ? 'title' : 'titles'}${owner} on Reely`
  // The list's own posters, composed into one 1200x630 card by the image CDN —
  // see lib/og/mosaic.ts. A single portrait poster as og:image was the previous
  // behaviour and unfurled as a centre-cropped band of one poster; it stays as
  // the fallback for a list whose first titles have no artwork at all.
  const mosaic = mosaicUrl({
    title: list.name,
    subtitle: shelf,
    posters: items.map((item) => item.poster_path),
  })
  const meta = {
    heading: list.name,
    title: list.name,
    description: list.description || `${shelf}.`,
    image:
      mosaic ||
      (items[0]?.poster_path ? getImageURL(items[0].poster_path) : ''),
    imageWidth: mosaic ? OG_WIDTH : null,
    imageHeight: mosaic ? OG_HEIGHT : null,
    canonical: `${siteUrl}/l/${slug}`,
  }
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: list.name,
    description: meta.description,
    url: meta.canonical,
    numberOfItems: count,
    itemListElement: items.slice(0, 20).map((item, index) => ({
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

/**
 * A public profile at /u/<handle>.
 *
 * Not stored in `caches.default`, for the same reason as the list page above:
 * unpublishing has to take the page down at once, and a cached copy would keep
 * serving somebody's library for the rest of its TTL. What it costs is three
 * indexed D1 reads, which is I/O and no CPU.
 */
async function handleProfilePage(match, env, url) {
  const [, handle] = match
  const db = env.DB
  if (!db) return notFoundAsset(env, url)

  const profile = await loadPublicProfile(db, handle, Date.now())
  if (!profile) return notFoundAsset(env, url)

  const siteUrl = siteUrlOf(url)
  const who = profile.name || profile.handle
  // The titles somebody rated highest, as the same composed card the lists use.
  // A profile whose owner has rated nothing keeps the avatar: a face is a
  // better unfurl than an empty shelf, and it is the only picture there is.
  const mosaic = mosaicUrl({
    title: who,
    subtitle: `${profile.counts.finished} films, ${profile.counts.episodes} episodes, ${profile.counts.lists} lists on Reely`,
    posters: profile.topRated.map((title) => title.poster_path),
  })
  const meta = {
    // The heading is what becomes <title>, og:title and the crawlable <h1>
    // (see metaTags/seoBlock) — so it carries the site name here rather than
    // leaving a shared link reading as a bare personal name with no context.
    heading: `${who} on Reely`,
    description:
      profile.bio ||
      `${profile.counts.finished} films finished, ${profile.counts.episodes} episodes ticked off, ${profile.counts.lists} lists worth stealing.`,
    image: mosaic || profile.picture || '',
    imageWidth: mosaic ? OG_WIDTH : null,
    imageHeight: mosaic ? OG_HEIGHT : null,
    canonical: `${siteUrl}/u/${profile.handle}`,
  }
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    dateCreated: new Date(profile.since).toISOString(),
    mainEntity: {
      '@type': 'Person',
      name: who,
      alternateName: profile.handle,
      description: profile.bio || undefined,
      image: profile.picture || undefined,
      url: meta.canonical,
    },
  }

  return (
    serveShellFromTemplate(SHELL_PROFILE, meta, 'profile', jsonLd) ??
    serveShell(SHELL_PROFILE, meta, 'profile', jsonLd, env, url)
  )
}

/**
 * The public directory at /lists.
 *
 * The one page on the site that is BOTH a real exported page and answered by
 * the Worker: `/lists` is in `run_worker_first`, so this runs instead of the
 * asset being served directly, and what it serves is that same asset with the
 * directory's links written into it. A crawler needs anchors in the first byte
 * — the rows here were written by people after the build, so nothing else can
 * put them there.
 *
 * Cached in `caches.default`, unlike /l/<slug> and /u/<handle>: nothing on this
 * page belongs to one person, and a list that appears ten minutes late in an
 * index is not the same problem as a page somebody unpublished still being up.
 */
async function handleListsDirectory(request, env, ctx, url) {
  const db = env.DB
  if (!db) return notFoundAsset(env, url)

  return cached(
    request,
    ctx,
    async () => {
      const directory = await loadDirectory(db, Date.now())
      const siteUrl = siteUrlOf(url)
      const lists = directory.lists
      const links = [
        ...lists.map((list) => ({
          href: `${siteUrl}/l/${list.slug}`,
          text: list.name,
        })),
        ...directory.people.map((person) => ({
          href: `${siteUrl}/u/${person.handle}`,
          text: `${person.name || person.handle} on Reely`,
        })),
      ]

      const meta = {
        heading: 'Lists and people on Reely',
        description: lists.length
          ? `${lists.length} film and TV lists published by people who keep their library on Reely, and the public pages behind them.`
          : 'Film and TV lists published by people who keep their library on Reely.',
        // The newest list's posters, as the same composed card a single list
        // unfurls with — so the directory looks like what it indexes.
        image:
          mosaicUrl({
            title: 'Lists on Reely',
            subtitle: 'Shelves people published, free to steal from',
            posters: lists.flatMap((list) => list.posters).slice(0, 5),
          }) || '',
        canonical: `${siteUrl}/lists`,
        links,
      }
      meta.imageWidth = meta.image ? OG_WIDTH : null
      meta.imageHeight = meta.image ? OG_HEIGHT : null

      const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: meta.heading,
        description: meta.description,
        url: meta.canonical,
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: lists.length,
          itemListElement: lists.map((list, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: list.name,
            url: `${siteUrl}/l/${list.slug}`,
          })),
        },
      }

      return (
        serveShellFromTemplate(SHELL_LISTS, meta, 'website', jsonLd) ??
        (await serveShell(SHELL_LISTS, meta, 'website', jsonLd, env, url))
      )
    },
    `${url.origin}/lists`
  )
}

/**
 * POST /api/pro/ticket — mint one 90-second playback ticket for the private
 * player worker.
 *
 * This is the whole "only us" anchor. The private player verifies nothing but
 * this signature (shared PLAYBACK_TICKET_SECRET/TICKET_SECRET), so whoever can
 * get a ticket here can play — and nobody else:
 *
 *   - A session in THIS database is required, always. Sessions come from this
 *     site's Google OAuth and live in this D1; a fork of the open-source repo
 *     cannot create rows here, so a cloner's deployment can never mint tickets
 *     our player accepts.
 *   - While PRO_PLAYER_OPEN is set, every signed-in visitor gets one: the
 *     player is the site default for everyone while it proves itself.
 *   - Without that var, entitlement is enforced exactly like every other
 *     supporter feature (402), and flipping is removing one wrangler var.
 */
async function handleProTicket(request, env, url) {
  const now = Date.now()
  // The open-for-everyone window: NO account required at all - the Reely
  // Player is the default source for every visitor. Removing PRO_PLAYER_OPEN
  // flips these checks back on and locks tickets to signed-in supporters,
  // with no client change involved.
  if (!env.PRO_PLAYER_OPEN) {
    const user = await loadSession(env.DB, sessionCookieOf(request), now)
    if (!user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Not signed in' }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
          },
        }
      )
    }
    if (!isEntitled(user, now)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'The Reely Player is a supporter feature.',
        }),
        {
          status: 402,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
          },
        }
      )
    }
  }

  let body
  try {
    body = await request.json()
  } catch {
    body = null
  }
  const type = body && isTv(body.type) ? 'tv' : 'movie'
  const id = Number(body?.id)
  if (!Number.isFinite(id) || id <= 0 || !body?.title) {
    return new Response(
      JSON.stringify({ success: false, error: 'Bad request' }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      }
    )
  }
  const season = Number(body.season)
  const episode = Number(body.episode)
  const start = Math.max(0, Number(body.start) || 0)
  const year = Number(body.year)

  const base = env.PLAYBACK_WORKER_URL?.trim().replace(/\/$/, '')
  const ticket = await signEntryTicket(env.PLAYBACK_TICKET_SECRET, {
    type,
    id,
    ...(type === 'tv' ? { season, episode } : {}),
  })
  if (!base || !ticket) {
    return new Response(
      JSON.stringify({ success: false, error: 'Playback not configured' }),
      {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      }
    )
  }

  // `o` tells the player which parent origin it may postMessage progress to —
  // and doubles as its embed allowlist check.
  const params = new URLSearchParams({
    type,
    id: String(id),
    t: ticket,
    o: url.origin,
    start: String(Math.floor(start)),
    title: String(body.title).slice(0, 120),
  })
  if (type === 'tv') {
    params.set('season', String(Number.isFinite(season) ? season : 1))
    params.set('episode', String(Number.isFinite(episode) ? episode : 1))
  }
  if (Number.isFinite(year) && year > 1900) params.set('year', String(year))
  // The IMDb id the detail page already had. The player's first subtitle
  // source is addressable by it alone, so without this the deepest catalog is
  // simply unreachable — it is not a nice-to-have.
  if (typeof body.imdb === 'string' && /^ttd{5,12}$/.test(body.imdb)) {
    params.set('im', body.imdb)
  }
  // Playback prefs ride along so the player applies them on boot without a
  // round trip of its own. See lib/playback-prefs.ts for where they come from.
  const prefs = body.playback
  if (prefs && typeof prefs === 'object') {
    if (typeof prefs.sub === 'string' && prefs.sub.length <= 5) {
      params.set('sub', prefs.sub)
    }
    if (
      prefs.subSize === 's' ||
      prefs.subSize === 'm' ||
      prefs.subSize === 'l'
    ) {
      params.set('subs', prefs.subSize)
    }
    // Only the "on" case travels: the player's default is off, and a device
    // that was told directly overrides whatever the account says.
    if (prefs.miniBar === true) params.set('mini', '1')
  }

  return new Response(
    JSON.stringify({ success: true, url: `${base}/play?${params}` }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    }
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
    if (pathname === '/api/pro/ticket' && request.method === 'POST') {
      return await handleProTicket(request, env, url)
    }

    // Same story for the party features: their writes are POSTs inside
    // handleApi, which the GET/HEAD guard below would never reach.
    if (
      request.method === 'POST' &&
      (pathname === '/api/match/room' ||
        pathname === '/api/match/swipe' ||
        pathname === '/api/together/room' ||
        pathname === '/api/together/beat')
    ) {
      return await handleApi(pathname, url, request, ctx, env)
    }

    if (ownsPath(pathname)) {
      try {
        // Imported here, not at the top: esbuild keeps a module reached only
        // through `import()` behind a lazy initialiser, so the seventeen route
        // modules the router pulls in are evaluated in the isolates that serve
        // an account request and in no others. 96% of this Worker's traffic is
        // tail-id page fallbacks, and they used to pay that startup cost too.
        const { routeAccountApi } = await import('@/lib/api/account-router')
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
        return await handleApi(pathname, url, request, ctx, env)
      }

      const list = pathname.match(LIST_PATH)
      if (list) {
        return await handleListPage(list, env, url)
      }

      if (LISTS_PATH.test(pathname)) {
        return await handleListsDirectory(request, env, ctx, url)
      }

      const profile = pathname.match(PROFILE_PATH)
      if (profile) {
        return await handleProfilePage(profile, env, url)
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
