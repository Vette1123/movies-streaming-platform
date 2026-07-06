'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

import { trackPageNotFound } from '@/lib/analytics'

/** Fires a `page_not_found` event when the 404 page renders. */
export function NotFoundTracker() {
  const pathname = usePathname()

  useEffect(() => {
    trackPageNotFound({ path: pathname ?? undefined })
  }, [pathname])

  return null
}
