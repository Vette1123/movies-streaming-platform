/*
 * Reely service worker — makes the site installable (PWA) and instant on repeat
 * visits. Deliberately MINIMAL and safe for this stack:
 *   - The streaming player (VidSrc) and ALL cross-origin media (ImageKit, TMDB,
 *     wsrv, analytics, fonts) are NEVER intercepted — they go straight to the
 *     network. A movie always streams live; nothing is (or can be) cached for
 *     offline playback.
 *   - Dynamic app data (RSC payloads `?_rsc=`, `/api/*`, any non-GET / server
 *     action) is never cached, so pages stay fresh.
 *   - Page navigations are network-first, so the Cloudflare edge cache still
 *     serves fresh HTML when online; the SW only steps in offline.
 * Its real jobs: (1) satisfy the install criteria, (2) cache-first the immutable
 * hashed build assets for instant loads, (3) show a friendly offline page.
 *
 * Bump CACHE to invalidate everything on the next visit.
 */
const CACHE = 'reely-v1'
const OFFLINE_URL = '/offline.html'
const PRECACHE = [OFFLINE_URL]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  )
})

function putInCache(request, response) {
  const copy = response.clone()
  caches.open(CACHE).then((cache) => cache.put(request, copy))
}

self.addEventListener('fetch', (event) => {
  const { request } = event

  // Only GET is cacheable; POST/server-actions pass straight through.
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Cross-origin (video iframe, image CDNs, analytics, fonts) — never touch.
  if (url.origin !== self.location.origin) return

  // Never cache dynamic data: server-action/RSC payloads and API routes.
  if (url.pathname.startsWith('/api/') || url.searchParams.has('_rsc')) return

  // Immutable hashed build assets → cache-first (instant repeat loads).
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            putInCache(request, res)
            return res
          })
      )
    )
    return
  }

  // Page navigations → network-first (fresh movie data), fall back to the last
  // cached copy of that exact page, then the offline page.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          putInCache(request, res)
          return res
        })
        .catch(() =>
          caches
            .match(request)
            .then((cached) => cached || caches.match(OFFLINE_URL))
        )
    )
    return
  }

  // Other same-origin GETs (icons, manifest, public images) → stale-while-revalidate.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          putInCache(request, res)
          return res
        })
        .catch(() => cached)
      return cached || network
    })
  )
})
