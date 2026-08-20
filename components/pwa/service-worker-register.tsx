'use client'

import React from 'react'

// Dev builds are deliberately SW-free. public/sw.js caches hashed chunks, and
// dev rebuilds them on every edit: the stale cache then hands React a chunk from
// a previous build ("module factory is not available"), hydration dies, and the
// page sits there as dead server HTML. The cache is only worth anything against
// a deployed, immutable build, so localhost skips it — and tears down any worker
// a previous dev session (or a prod visit on the same host) already installed.
const IS_DEV = process.env.NODE_ENV === 'development'

const unregisterAll = async () => {
  try {
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(registrations.map((worker) => worker.unregister()))
    if (!('caches' in window)) return
    const keys = await caches.keys()
    await Promise.all(keys.map((key) => caches.delete(key)))
  } catch {
    // Storage blocked / unsupported — nothing to clean up.
  }
}

/**
 * Registers the PWA service worker (public/sw.js) after the page has loaded, so
 * it never competes with the initial render / LCP. Renders nothing. Safe to
 * mount unconditionally: it no-ops where service workers aren't supported, and
 * in dev it unregisters instead of registering (see IS_DEV above).
 *
 * Also keeps an installed PWA current across deploys. Two things stop that from
 * happening on its own:
 *   - The browser only re-checks /sw.js on a navigation (and no more than once a
 *     day). A standalone window that the user just switches away from and back
 *     to never navigates, so it can run a retired build for days — until it asks
 *     for a hashed chunk the deploy deleted and dies on the stale-deploy
 *     boundary. So: `registration.update()` every time the app is foregrounded.
 *   - sw.js is byte-identical between deploys unless something stamps the build
 *     into it, and an identical worker is not an update. scripts/build-worker.mjs
 *     stamps the build id into out/sw.js for exactly this.
 * It never reloads the page. It used to, on the foregrounding after a new worker
 * took over — and that is what an app switch felt like: you come back and the
 * document has thrown your place away. Nothing about a deploy is worth that. The
 * worker updates in the background and the fresh build is what the next ordinary
 * navigation renders.
 */
export function ServiceWorkerRegister() {
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return
    if (IS_DEV) {
      void unregisterAll()
      return
    }

    let registration: ServiceWorkerRegistration | undefined

    // Check for a newer worker when the app is foregrounded, and stop there.
    // This deliberately does NOT reload the page: an app that reloads itself
    // while you are away is the app losing your place, and no update is worth
    // that. The new worker installs and takes over; the fresh build is what the
    // next real navigation renders. If a page that has been open across a
    // deploy does reach for a chunk the deploy deleted, lib/client-errors.ts
    // still recovers it — that is error recovery, not a background refresh.
    const onForeground = () => {
      if (document.visibilityState !== 'visible') return
      void registration?.update().catch(() => {
        // Offline or the check 404s — the next foreground tries again.
      })
    }

    document.addEventListener('visibilitychange', onForeground)

    const register = () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          registration = reg
        })
        .catch(() => {
          // Registration failing is non-fatal — the site works fine without it.
        })
    }

    if (document.readyState === 'complete') {
      register()
    } else {
      window.addEventListener('load', register, { once: true })
    }

    return () => {
      window.removeEventListener('load', register)
      document.removeEventListener('visibilitychange', onForeground)
    }
  }, [])

  return null
}
