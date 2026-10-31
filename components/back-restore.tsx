'use client'

import React from 'react'
import { usePathname } from 'next/navigation'

import {
  arrivedByHistory,
  forgetPage,
  isBackPending,
  leaveLanding,
  markBack,
  pageKey,
  rememberPage,
  restoredScroll,
  settleBack,
} from '@/lib/back-restore'
import { useIsoLayoutEffect } from '@/hooks/use-iso-layout-effect'

const SAVE_DELAY_MS = 120
const GIVE_UP_MS = 2500
const USER_INPUT = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const

const jumpTo = (y: number) => window.scrollTo({ top: y, behavior: 'instant' })

// Reaching y once is not enough. The rebuilt page starts shorter than the one
// you left, so an early jump clamps; and blocks that mount a moment later, above
// where you are, push you down through scroll anchoring (measured: 228px). So
// keep answering every height change until it settles or you touch the page.
function restoreScroll(y: number) {
  jumpTo(y)
  const stop = () => {
    observer.disconnect()
    clearTimeout(timer)
    USER_INPUT.forEach((type) => window.removeEventListener(type, stop))
  }
  const observer = new ResizeObserver(() => jumpTo(y))
  const timer = setTimeout(stop, GIVE_UP_MS)
  observer.observe(document.documentElement)
  USER_INPUT.forEach((type) =>
    window.addEventListener(type, stop, { passive: true })
  )
}

/**
 * Takes scroll restoration over from the browser, which restores on popstate
 * while the page you are leaving is still on screen. Renders nothing, mounted
 * once in the root layout. See lib/back-restore.ts.
 */
export function BackRestore() {
  const pathname = usePathname()
  const lastPath = React.useRef(pathname)

  useIsoLayoutEffect(() => {
    // Compared, not a first-run flag: Strict Mode runs this twice on mount, and
    // the second run would forget the place a full-page Back is restoring.
    if (pathname === lastPath.current) return
    lastPath.current = pathname
    leaveLanding()
    if (isBackPending()) {
      restoreScroll(restoredScroll())
      settleBack()
    } else {
      forgetPage()
    }
  }, [pathname])

  React.useEffect(() => {
    history.scrollRestoration = 'manual'
    if (arrivedByHistory()) restoreScroll(restoredScroll())
    else forgetPage()

    // The page and the numbers are taken when the scroll happens, because by
    // the time the timer fires the URL may already be the next page's.
    let pending: { page: string; y: number; rails: Record<string, number> } = {
      page: pageKey(),
      y: window.scrollY,
      rails: {},
    }
    let timer: ReturnType<typeof setTimeout> | undefined
    const flush = () => {
      clearTimeout(timer)
      rememberPage(pending.page, pending)
      pending = { ...pending, rails: {} }
    }
    const onScroll = (event: Event) => {
      if (isBackPending()) return
      const page = pageKey()
      const rails = page === pending.page ? pending.rails : {}
      const rail =
        event.target instanceof HTMLElement && event.target.dataset.rail
      if (rail) rails[rail] = (event.target as HTMLElement).scrollLeft
      pending = { page, y: window.scrollY, rails }
      clearTimeout(timer)
      timer = setTimeout(flush, SAVE_DELAY_MS)
    }
    // A pathname that did not change is a dialog or a filter, not a new page.
    const onPopState = () => {
      if (location.pathname !== lastPath.current) markBack()
    }

    window.addEventListener('scroll', onScroll, {
      capture: true,
      passive: true,
    })
    window.addEventListener('popstate', onPopState)
    // A tap can land inside the delay after the scroll that found the poster.
    document.addEventListener('click', flush, true)
    window.addEventListener('pagehide', flush)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('scroll', onScroll, { capture: true })
      window.removeEventListener('popstate', onPopState)
      document.removeEventListener('click', flush, true)
      window.removeEventListener('pagehide', flush)
    }
  }, [])

  return null
}
