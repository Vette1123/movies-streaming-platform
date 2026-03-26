'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import posthog from 'posthog-js'

export function PostHogPageView() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const prevUrl = useRef<string | null>(null)

  useEffect(() => {
    const url =
      window.location.origin +
      pathname +
      (searchParams.toString() ? `?${searchParams.toString()}` : '')

    if (url === prevUrl.current) return
    prevUrl.current = url

    posthog.capture('$pageview', { $current_url: url })
  }, [pathname, searchParams])

  return null
}
