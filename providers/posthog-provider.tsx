'use client'

import { PropsWithChildren, Suspense, useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import posthog, { CaptureResult, ConfigDefaults } from 'posthog-js'
import { PostHogProvider, usePostHog } from 'posthog-js/react'

import { trackPwaInstallable, trackPwaInstalled } from '@/lib/analytics'
import { enrichPersonProfile } from '@/lib/person'

/**
 * Runtime context attached to every captured $exception. Our production stack
 * frames are minified and often fail to symbolicate (the source chunk 403s),
 * so the raw stack tells us little. These props answer "where / on what screen
 * did it happen" directly: the exact route, viewport + screen + DPR, display
 * mode (PWA vs browser), network quality, memory, and page visibility — the
 * "screen, component, and so on" that makes an exception actionable.
 */
function errorContext(): Record<string, unknown> {
  if (typeof window === 'undefined') return {}
  try {
    const nav = navigator as Navigator & {
      connection?: { effectiveType?: string; downlink?: number; rtt?: number }
      deviceMemory?: number
    }
    const conn = nav.connection
    return {
      error_pathname: window.location.pathname,
      error_url: window.location.href,
      error_referrer: document.referrer || undefined,
      viewport_width: window.innerWidth,
      viewport_height: window.innerHeight,
      screen_width: window.screen?.width,
      screen_height: window.screen?.height,
      device_pixel_ratio: window.devicePixelRatio,
      orientation: window.screen?.orientation?.type,
      document_visibility: document.visibilityState,
      online: nav.onLine,
      network_effective_type: conn?.effectiveType,
      network_downlink: conn?.downlink,
      device_memory_gb: nav.deviceMemory,
      display_mode: window.matchMedia?.('(display-mode: standalone)').matches
        ? 'standalone'
        : 'browser',
    }
  } catch {
    return {}
  }
}

/**
 * The full PostHog config — autocapture, dead-clicks, rageclick, web vitals,
 * heatmaps, exception tracking, session recording, person profiles. Every
 * feature is kept ON; nothing is dropped. This is just the config object,
 * factored out so the deferred init path below reads cleanly.
 */
const POSTHOG_CONFIG = {
  api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST as string,
  ui_host: 'https://eu.posthog.com',
  // Opt into PostHog's current recommended defaults; explicit options below
  // still win over anything the preset would set.
  defaults: '2025-05-24' as ConfigDefaults,
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
  // Enrich every $exception with route + device context (see errorContext).
  // Wrapped defensively so enrichment can never drop an exception event.
  before_send: (event: CaptureResult | null) => {
    if (event && event.event === '$exception') {
      event.properties = { ...event.properties, ...errorContext() }
    }
    return event
  },
  // This app has no login, so identified_only would leave every visitor
  // profile-less. 'always' gives each visitor a person profile enriched
  // with geo / device / UTM (auto) plus our own props (see lib/person.ts).
  person_profiles: 'always' as const,
  // Session replay.
  disable_session_recording: false,
  session_recording: {
    maskAllInputs: true,
    maskTextSelector: '[data-ph-mask]',
    recordCrossOriginIframes: false,
  },
}

let initialized = false

/**
 * Lazily run posthog.init() exactly once. Init is the single most expensive
 * thing PostHog does on a cold load — it parses the DOM for autocapture,
 * attaches heatmaps, boots the session-recorder, sets up web-vitals + exception
 * listeners, and fires the identify + feature-flag requests. Doing all of that
 * synchronously during hydration blocks the main thread and is what tanks
 * Lighthouse's TBT. So we defer it until the browser is idle (or the user
 * interacts — whichever is first) via requestIdleCallback. LCP and INP no longer
 * pay for it; every event is still captured (posthog queues calls made before
 * init, and $pageview fires from <PostHogPageView> right after init resolves).
 */
function initPosthog() {
  if (initialized || !process.env.NEXT_PUBLIC_POSTHOG_KEY) return
  initialized = true
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY as string, POSTHOG_CONFIG)
  // The deferred init means the first $pageview (which <PostHogPageView> gated
  // on `ph` being truthy) was skipped during the pre-init window. Capture it
  // now so the landing visit is attributed — equivalent to the eager path.
  posthog.capture('$pageview', { $current_url: window.location.href })
}

/**
 * Schedule init as soon as the main thread is free. requestIdleCallback keeps
 * it off the critical path; the 2000ms timeout guarantees it still runs on
 * browsers that stay busy, so data is never permanently lost. We also listen
 * for the FIRST user gesture (any of pointer/scroll/keydown) and init
 * immediately then — the idle callback is the happy path, the gesture listener
 * is the "user is engaging, prioritize it" fallback, and it doubles as the
 * user-activation the recorder/autocapture benefit from.
 */
function scheduleInit() {
  if (typeof window === 'undefined' || initialized) return

  // requestIdleCallback's { timeout } is a HARD ceiling: if the browser hasn't
  // gone idle within 2s, it runs anyway. This guarantees analytics never waits
  // indefinitely on a busy main thread, while still keeping init off the LCP/INP
  // critical path in the common (idle-soon) case.
  const ric = (window as { requestIdleCallback?: typeof requestIdleCallback })
    .requestIdleCallback
  const handle: number = ric
    ? ric(initPosthog, { timeout: 2000 })
    : (window.setTimeout(initPosthog, 1) as number)

  const events: (keyof WindowEventMap)[] = [
    'pointerdown',
    'keydown',
    'scroll',
    'wheel',
  ]
  let flushed = false
  const onFirstGesture = () => {
    if (flushed) return
    flushed = true
    const w = window as Window & {
      cancelIdleCallback?: (handle: number) => void
    }
    if (typeof w.cancelIdleCallback === 'function') w.cancelIdleCallback(handle)
    else window.clearTimeout(handle)
    initPosthog()
    for (const e of events) window.removeEventListener(e, onFirstGesture, true)
  }
  for (const e of events) window.addEventListener(e, onFirstGesture, true)
}

if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  // Don't init eagerly — schedule it off the critical path (see scheduleInit).
  // posthog (the singleton) is safe to reference now: calls like capture() made
  // before init are queued and flushed once init() runs.
  scheduleInit()
}

/**
 * Captures a $pageview on every route change. Next.js App Router does
 * client-side navigation, so we listen to pathname + search param changes.
 * Wrapped in Suspense because useSearchParams needs a boundary.
 *
 * Because init() is deferred (see scheduleInit), this skips the pre-init
 * window — the landing $pageview is fired once from initPosthog() — and only
 * starts capturing subsequent navigations. A last-URL guard dedupes the re-run
 * that fires when the provider re-renders as init completes.
 */
function PostHogPageView() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const ph = usePostHog()
  const lastUrl = useRef<string | null>(null)

  useEffect(() => {
    if (!pathname || !ph || !initialized) return
    let url = window.origin + pathname
    const qs = searchParams?.toString()
    if (qs) url += `?${qs}`
    if (lastUrl.current === url) return
    lastUrl.current = url
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
