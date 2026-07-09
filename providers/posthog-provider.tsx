'use client'

import { PropsWithChildren, Suspense, useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import posthog from 'posthog-js'
import { PostHogProvider, usePostHog } from 'posthog-js/react'

import { trackPwaInstallable, trackPwaInstalled } from '@/lib/analytics'
import { enrichPersonProfile } from '@/lib/person'

if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY as string, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST as string,
    ui_host: 'https://eu.posthog.com',
    // Opt into PostHog's current recommended defaults; explicit options below
    // still win over anything the preset would set.
    defaults: '2025-05-24',
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
    // Error Tracking: autocapture unhandled errors / promise rejections
    // as $exception events.
    capture_exceptions: true,
    // This app has no login, so identified_only would leave every visitor
    // profile-less. 'always' gives each visitor a person profile enriched
    // with geo / device / UTM (auto) plus our own props (see lib/person.ts).
    person_profiles: 'always',
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

/**
 * Enriches the visitor's person profile once on mount with device / locale /
 * environment properties, and registers super properties carried on every
 * event. Behavioral watch-history stats are synced separately from
 * useWatchedMedia as they change.
 */
function PostHogIdentity() {
  useEffect(() => {
    enrichPersonProfile()
  }, [])

  return null
}

/**
 * Tracks PWA install lifecycle: when the browser reports the app is
 * installable, and when it actually gets installed (also flips the person
 * profile's pwa_installed trait to true).
 */
function PwaInstallTracker() {
  useEffect(() => {
    const onBeforeInstallPrompt = () => trackPwaInstallable()
    const onAppInstalled = () => {
      trackPwaInstalled()
      posthog.setPersonProperties({ pwa_installed: true })
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onAppInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [])

  return null
}

export function CSPostHogProvider({ children }: PropsWithChildren) {
  return (
    <PostHogProvider client={posthog}>
      <SuspendedPageView />
      <PostHogIdentity />
      <PwaInstallTracker />
      {children}
    </PostHogProvider>
  )
}
