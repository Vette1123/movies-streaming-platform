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
 * Bump BUILD (or just deploy) to invalidate everything on the next visit.
 */
// `__BUILD_ID__` is replaced with the Next build id by scripts/build-worker.mjs.
// Two jobs, both required for an installed PWA to ever see a new deploy:
//   - It makes this file's BYTES change every build. A byte-identical /sw.js is
//     not an update as far as the browser is concerned, so without it the
//     `registration.update()` in components/pwa/service-worker-register.tsx has
//     nothing to install and a standalone window can run a retired build for
//     days.
//   - It scopes the cache to one build, so the activate handler below drops the
//     previous build's entries instead of serving chunk URLs the deploy deleted.
// It stays literal in `next dev` / a non-export build; the SW is not registered
// in dev, and one stable cache name there is harmless.
const CACHE = 'reely-__BUILD_ID__'
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

// Only ever store a complete success. Caching a failure is what turned a
// transient post-deploy 404 into a permanent one: we deploy ~4x/day and each
// build retires the previous build's hashed chunks, so a tab that outlived a
// deploy asks for a chunk that is gone, the Worker answers 404 + HTML, and
// storing that response meant every later load of that URL got HTML from the
// cache instead of JS. A miss is always recoverable; a bad hit is not.
// `status !== 200` also rejects 206 partials, which the Cache API can't replay.
function putInCache(request, response) {
  if (!response.ok || response.status !== 200) return
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
