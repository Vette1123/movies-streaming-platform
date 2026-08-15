/*
 * Reely service worker — makes the site installable (PWA) and instant on repeat
 * visits. Deliberately MINIMAL and safe for this stack:
 *   - The streaming player (VidSrc) and ALL cross-origin media (ImageKit, TMDB,
 *     wsrv, analytics, fonts) are NEVER intercepted — they go straight to the
 *     network. A movie always streams live; nothing is (or can be) cached for
 *     offline playback.
 *   - Live app data (`/api/*`, any non-GET) is never cached, so search, filters
 *     and season lists always hit TMDB. RSC navigation payloads are a different
 *     thing despite looking dynamic — under `output: 'export'` they are
 *     prerendered files — and ARE cached, build-scoped; see the fetch handler.
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

  // Never cache live app data. /api/* is the Worker calling TMDB — search
  // results, filters, season lists — and must always be fresh.
  if (url.pathname.startsWith('/api/')) return

  // RSC navigation payloads (`?_rsc=`) → stale-while-revalidate.
  //
  // These used to be lumped in with /api/* and skipped outright, on the
  // reasoning that they are "dynamic app data". They are not: under
  // `output: 'export'` every one of them is a PRERENDERED FILE, a build-time
  // snapshot of exactly the same vintage as the .html sitting next to it. The
  // only thing that makes one stale is a deploy — and CACHE is keyed by the
  // build id, so a deploy drops the whole set on activate. There is no window in
  // which this can serve a payload from a build the page isn't running.
  //
  // What it buys: every route the visitor has already opened, plus everything
  // the Link prefetcher warmed on the way past, navigates with ZERO network.
  // Even a fresh one costs only the revalidation, since the response comes off
  // the cache first. The origin fetch still runs and still overwrites, so a
  // same-build re-deploy is picked up on the next visit either way.
  if (url.searchParams.has('_rsc')) {
    // ignoreSearch, because `_rsc` is the router's own cache-buster and the
    // path already identifies the payload uniquely. Matching on the full URL
    // would make every entry a one-shot: the value is stable per URL today, but
    // it is Next's to change, and a cache that silently stops hitting is worse
    // than no cache at all. No other query string reaches these paths.
    event.respondWith(
      caches.match(request, { ignoreSearch: true }).then((cached) => {
        const network = fetch(request)
          .then((res) => {
            putInCache(request, res)
            return res
          })
          .catch(() => cached)
        return cached || network
      })
    )
    return
  }

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

/*
 * Push notifications for supporters.
 *
 * The push itself carries NO payload — see lib/push/vapid.ts for why (it
 * removes the ECDH + HKDF + AES128GCM half of web push entirely). So this
 * handler's first job is to go and find out what it was woken up for.
 *
 * `credentials: 'include'` is load-bearing: a service worker woken by a push has
 * no access to any page's memory, so the httpOnly session cookie is the only
 * credential available to it. That is also why /api/push/pending authenticates
 * with the cookie rather than with an access token.
 *
 * A push that resolves to nothing still shows something. Every browser that
 * grants the permission requires a visible notification per push, and a silent
 * one costs the site its notification permission.
 */
self.addEventListener('push', (event) => {
  event.waitUntil(
    fetch('/api/push/pending', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const items = (data && data.notifications) || []
        if (items.length === 0) {
          return self.registration.showNotification('Reely', {
            body: 'Something you follow has an update.',
            icon: '/android-chrome-192x192.png',
            badge: '/android-chrome-192x192.png',
            data: { url: '/watchlist' },
          })
        }
        return Promise.all(
          items.map((item) =>
            self.registration.showNotification(item.title, {
              body: item.body,
              icon: '/android-chrome-192x192.png',
              badge: '/android-chrome-192x192.png',
              // One tag per target, so two pushes about the same show replace
              // each other in the tray instead of stacking.
              tag: item.url,
              data: { url: item.url },
            })
          )
        )
      })
      .catch(() =>
        self.registration.showNotification('Reely', {
          body: 'Something you follow has an update.',
          icon: '/android-chrome-192x192.png',
          data: { url: '/watchlist' },
        })
      )
  )
})

// Focus an open tab rather than opening a second one, which is what turns a
// notification tap into "the app I already had" instead of a duplicate window.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ('focus' in client) {
            client.navigate(target)
            return client.focus()
          }
        }
        return self.clients.openWindow(target)
      })
  )
})
