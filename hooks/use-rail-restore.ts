'use client'

import React from 'react'

import { restoredRail } from '@/lib/back-restore'
import { useIsoLayoutEffect } from '@/hooks/use-iso-layout-effect'

// A rail below the fold is content-visibility: skipped, so it has no scroll width
// to restore into until it nears the screen. That is the second attempt.
export function useRailRestore(
  ref: React.RefObject<HTMLElement | null>,
  rail: string
) {
  useIsoLayoutEffect(() => {
    const el = ref.current
    const left = restoredRail(rail)
    if (!el || !left) return
    el.scrollLeft = left
    if (Math.abs(el.scrollLeft - left) < 2) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        el.scrollLeft = left
        observer.disconnect()
      },
      { rootMargin: '400px 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref, rail])
}
