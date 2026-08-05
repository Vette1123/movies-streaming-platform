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
 * The reload itself is deferred to the NEXT foregrounding rather than fired the
 * moment the new worker claims the page: a deploy lands while someone is halfway
 * through a trailer or a stream, and yanking the document out from under them is
 * worse than being one build behind for another minute.
 */
export function ServiceWorkerRegister() {
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return
    if (IS_DEV) {
      void unregisterAll()
      return
    }

    // Set once a newer worker has taken control; consumed on the next
    // foreground. `reloading` keeps a slow reload from queueing a second one.
    let pendingUpdate = false
    let reloading = false
    let registration: ServiceWorkerRegistration | undefined

    const onForeground = () => {
      if (document.visibilityState !== 'visible') return
      if (pendingUpdate) {
        if (reloading) return
        reloading = true
        window.location.reload()
        return
      }
      void registration?.update().catch(() => {
        // Offline or the check 404s — the next foreground tries again.
      })
    }

    // Fires when a new worker calls skipWaiting() + clients.claim(). A first
    // install claims an uncontrolled page too, and there is nothing stale about
    // that page, so only an existing controller being replaced counts.
    const onControllerChange = () => {
      pendingUpdate = true
    }
    const hadController = Boolean(navigator.serviceWorker.controller)
    if (hadController) {
      navigator.serviceWorker.addEventListener(
        'controllerchange',
        onControllerChange
      )
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
      navigator.serviceWorker.removeEventListener(
        'controllerchange',
        onControllerChange
      )
    }
  }, [])

  return null
}
