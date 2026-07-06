'use client'

import { PropsWithChildren, Suspense, useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import posthog from 'posthog-js'
import { PostHogProvider, usePostHog } from 'posthog-js/react'

if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY as string, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST as string,
    ui_host: 'https://eu.posthog.com',
    // We fire $pageview manually via <PostHogPageView> so App Router
    // client-side navigations are captured reliably.
    capture_pageview: false,
    capture_pageleave: true,
    // Autocapture every click / input / submit on the page.
    autocapture: true,
    // Extra engagement signals.
    capture_dead_clicks: true,
    rageclick: true,
    // Web vitals (LCP, FCP, CLS, INP) as $web_vitals events.
    capture_performance: { web_vitals: true },
    // Heatmaps data.
    enable_heatmaps: true,
    person_profiles: 'identified_only',
    // Session replay.
    disable_session_recording: false,
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: '[data-ph-mask]',
      recordCrossOriginIframes: false,
    },
  })
}

/**
 * Captures a $pageview on every route change. Next.js App Router does
 * client-side navigation, so we listen to pathname + search param changes.
 * Wrapped in Suspense because useSearchParams needs a boundary.
 */
function PostHogPageView() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const ph = usePostHog()

  useEffect(() => {
    if (!pathname || !ph) return
    let url = window.origin + pathname
    const qs = searchParams?.toString()
    if (qs) url += `?${qs}`
    ph.capture('$pageview', { $current_url: url })
  }, [pathname, searchParams, ph])

  return null
}

function SuspendedPageView() {
  return (
    <Suspense fallback={null}>
      <PostHogPageView />
    </Suspense>
  )
}

export function CSPostHogProvider({ children }: PropsWithChildren) {
  return (
    <PostHogProvider client={posthog}>
      <SuspendedPageView />
      {children}
    </PostHogProvider>
  )
}
