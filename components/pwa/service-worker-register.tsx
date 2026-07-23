'use client'

import React from 'react'

/**
 * Registers the PWA service worker (public/sw.js) after the page has loaded, so
 * it never competes with the initial render / LCP. Renders nothing. Safe to
 * mount unconditionally: it no-ops where service workers aren't supported.
 */
export function ServiceWorkerRegister() {
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

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
