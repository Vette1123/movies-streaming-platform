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
 */
export function ServiceWorkerRegister() {
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return
    if (IS_DEV) {
      void unregisterAll()
      return
    }

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Registration failing is non-fatal — the site works fine without it.
      })
    }

    if (document.readyState === 'complete') {
      register()
      return
    }
    window.addEventListener('load', register, { once: true })
    return () => window.removeEventListener('load', register)
  }, [])

  return null
}
