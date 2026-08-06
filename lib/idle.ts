// Run optional work once the page is done with the work that matters.
//
// Two things on this site are enhancements that were nonetheless scheduled off a
// plain timer from mount: PostHog's init, and the hero's trailer autoplay. Both
// therefore landed DURING hydration — the trailer at 1.2s, which on the homepage
// is roughly when React is still hydrating and the LCP backdrop is still
// decoding. Neither feature needs that slot. Deferring them changes nothing a
// user can see on a fast connection and is the whole difference between a
// usable page and a janky one on a slow device, because an embedded YouTube
// player is ~880KB of third-party script (measured) and PostHog is the largest
// chunk in the app.
//
// `requestIdleCallback` alone is not enough: a busy main thread can starve it
// indefinitely, so every call takes a hard `timeout` ceiling after which the
// browser runs it anyway. Optional work is deferred, never dropped.

/** Cancels a scheduled callback. Safe to call after it has already run. */
export type CancelIdle = () => void

/**
 * Schedule `callback` for the next idle period, but no later than `timeoutMs`.
 *
 * Falls back to a plain `setTimeout` where `requestIdleCallback` is missing
 * (Safari shipped it only in 18.4), so the work still happens — just without the
 * "wait for a genuinely free thread" part.
 */
export function onIdle(callback: () => void, timeoutMs: number): CancelIdle {
  if (typeof window === 'undefined') return () => {}

  const win = window as Window & {
    requestIdleCallback?: typeof requestIdleCallback
    cancelIdleCallback?: typeof cancelIdleCallback
  }

  if (!win.requestIdleCallback) {
    const id = win.setTimeout(callback, timeoutMs)
    return () => win.clearTimeout(id)
  }

  const handle = win.requestIdleCallback(callback, { timeout: timeoutMs })
  return () => win.cancelIdleCallback?.(handle)
}

/**
 * Like `onIdle`, but waits for the `load` event first when the document is still
 * loading — so the work queues behind the page's own images and scripts rather
 * than competing with them for the same idle slots.
 *
 * `load` (not `DOMContentLoaded`) is the right signal here: the point is to be
 * after the LCP image, and DOMContentLoaded fires long before that.
 */
export function onIdleAfterLoad(
  callback: () => void,
  timeoutMs: number
): CancelIdle {
  if (typeof window === 'undefined') return () => {}

  if (document.readyState === 'complete') return onIdle(callback, timeoutMs)

  let cancelIdle: CancelIdle | undefined
  const onLoad = () => {
    cancelIdle = onIdle(callback, timeoutMs)
  }
  window.addEventListener('load', onLoad, { once: true })

  return () => {
    window.removeEventListener('load', onLoad)
    cancelIdle?.()
  }
}
