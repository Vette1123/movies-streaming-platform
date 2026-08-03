import React from 'react'

// The live `window.location.pathname`, or '' while prerendering.
//
// The fallback shells (app/media-fallback, app/collection-fallback) are served
// by cloudflare/worker.js under paths they do not own, so they read the id out
// of the URL rather than from a route param. Next's `usePathname()` reports the
// router's idea of the route, which is the shell's own — not the served path.
//
// `useSyncExternalStore` rather than state-in-an-effect: the build prerenders
// these pages where there is no window, and the server snapshot ('') lets React
// swap in the real value on hydration without a second render pass or a
// mismatch. The path never changes without a full navigation, so there is
// nothing to subscribe to.
const noSubscribe = () => () => {}
const clientSnapshot = () => window.location.pathname
const serverSnapshot = () => ''

export function useLocationPathname(): string {
  return React.useSyncExternalStore(noSubscribe, clientSnapshot, serverSnapshot)
}
