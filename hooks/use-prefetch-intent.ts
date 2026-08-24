'use client'

import { useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'

// Warm a route the moment the visitor SHOWS they're heading there.
//
// Next 16 changed what `prefetch={false}` means. It used to switch off only the
// viewport auto-prefetch and still warm the route on hover; now it sets
// `prefetchEnabled = false`, which short-circuits the hover AND touch handlers
// too (next/dist/client/app-dir/link.js) — the Link prefetches nothing, ever.
// Every card/rail/hero link here carries that prop, because viewport
// auto-prefetch fires one request per card and a homepage of rails trips the CF
// rate limit. So the comments in those files claiming "prefetch on hover only"
// have quietly described nothing for a whole major version, and every tap paid
// for a cold RSC round trip at click time: measured on prod, 631ms from tap to
// paint on a fast desktop connection, of which 464ms was the payload nobody had
// asked for yet.
//
// `onTouchStart` is the one that matters. A phone has no hover, so mobile never
// warmed a single route — which is exactly where navigation felt slowest. The
// touch fires ~100ms before the click and the router reuses the in-flight
// request rather than starting its own.
//
// Fires once per href: router.prefetch is idempotent but not free, and a card
// can see many pointerenters.
/**
 * The three events that mean "this visitor is about to commit", as one stable
 * props object. Routes are not the only thing worth paying for early — the
 * house player's entry ticket is a round trip that can be spent while a thumb
 * is still travelling — so the intent half lives on its own.
 */
export function useIntentProps(warm: () => void) {
  // One stable object so spreading it onto an element doesn't hand it three
  // fresh handler props on every render.
  return useMemo(
    () => ({ onMouseEnter: warm, onFocus: warm, onTouchStart: warm }),
    [warm]
  )
}

export function usePrefetchIntent(href: string) {
  const router = useRouter()
  const warmed = useRef<string | null>(null)

  const warm = useCallback(() => {
    if (warmed.current === href) return
    warmed.current = href
    router.prefetch(href)
  }, [href, router])

  return useIntentProps(warm)
}
