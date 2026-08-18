'use client'

import { PropsWithChildren, Suspense, useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import type { CaptureResult, ConfigDefaults } from 'posthog-js'

import {
  trackImageHostFallback,
  trackPwaInstallable,
  trackPwaInstalled,
} from '@/lib/analytics'
import { shouldDropException } from '@/lib/error-noise'
import { onIdle } from '@/lib/idle'
import { enrichPersonProfile } from '@/lib/person'
import { analyticsEnabled, loadPostHog, ph } from '@/lib/posthog-client'
import { subscribePrimaryImageHost } from '@/lib/tmdbConfig'

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
      // Drop unactionable extension / cross-origin noise (React #418 &c.),
      // stale-bundle / transport failures, and anything thrown by code that is
      // not ours, so none of it buries the real, fixable errors in the
      // dashboard. The rules live in lib/error-noise.ts, where they are tested.
      if (shouldDropException(event)) return null
      event.properties = { ...event.properties, ...errorContext() }
    }
    return event
  },
  // This app has no login, so identified_only would leave every visitor
  // profile-less. 'always' gives each visitor a person profile enriched
  // with geo / device / UTM (auto) plus our own props (see lib/person.ts).
  person_profiles: 'always' as const,
  // Session replay. Whether it runs at all is decided per session — see
  // shouldRecordSession; this value is overridden at init.
  disable_session_recording: false,
  session_recording: {
    maskAllInputs: true,
    maskTextSelector: '[data-ph-mask]',
    recordCrossOriginIframes: false,
  },
}

/**
 * Fraction of sessions that get a session replay.
 *
 * Recording every session cost every visitor the recorder bundle: 57KB and a
 * 383ms long task, measured on the mobile homepage, where it was one of the
 * largest single blocking tasks on the page. Replays are a debugging tool
 * consumed a handful at a time, so paying for them on 100% of sessions buys
 * volume nobody watches at a price everybody pays.
 */
const REPLAY_SAMPLE_RATE = 0.1

/** sessionStorage key holding this session's sampling verdict. */
const REPLAY_KEY = 'reely:ph-replay'

/**
 * Decide once per session whether to record, and remember it.
 *
 * Rolling per page LOAD instead would shred a session across navigations —
 * three pages recorded, two missing, and the replay of a bug report jumps a gap
 * exactly where the interesting thing happened. A partial replay is worse than
 * no replay, because you cannot tell which one you are looking at. So the
 * verdict is taken on the first load of a session and reused for the rest of it.
 *
 * Falls back to recording when sessionStorage is unavailable (private mode,
 * blocked storage): the failure that keeps the feature working is the better
 * one, and those sessions are rare enough not to move the sample.
 */
function shouldRecordSession(): boolean {
  try {
    const stored = window.sessionStorage.getItem(REPLAY_KEY)
    if (stored === 'on') return true
    if (stored === 'off') return false
    const record = Math.random() < REPLAY_SAMPLE_RATE
    window.sessionStorage.setItem(REPLAY_KEY, record ? 'on' : 'off')
    return record
  } catch {
    return true
  }
}

let initialized = false

/**
 * Lazily load posthog-js and run posthog.init() exactly once.
 *
 * Two costs are being deferred here. Init itself is the expensive one at
 * runtime — it parses the DOM for autocapture, attaches heatmaps, boots the
 * session-recorder, sets up web-vitals + exception listeners, and fires the
 * identify + feature-flag requests. The module is the expensive one on the
 * network: 221KB raw / 73KB brotli, the largest chunk in the app. Doing either
 * during hydration blocks the main thread and is what tanks Lighthouse's TBT,
 * so both wait until the browser is idle (or the user interacts — whichever is
 * first). LCP and INP no longer pay for PostHog at all.
 *
 * Nothing is lost by waiting: calls made before this resolves are queued by
 * lib/posthog-client and replayed in order the moment the module lands.
 */
async function initPosthog() {
  if (initialized || !analyticsEnabled()) return
  initialized = true
  const posthog = await loadPostHog()
  if (!posthog) return
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY as string, {
    ...POSTHOG_CONFIG,
    // Rolled here rather than in the const so it is a client-side decision made
    // at init, not a value baked in when the module first evaluates.
    disable_session_recording: !shouldRecordSession(),
  })
  // The deferred init means the first $pageview (which <PostHogPageView> gates
  // on `initialized`) was skipped during the pre-init window. Capture it now so
  // the landing visit is attributed — equivalent to the eager path.
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

  // A prerendered page (speculation rules, or Cloudflare's Speed Brain if it
  // ever moves past prefetch) runs all of this in a hidden background renderer
  // for a navigation that may never happen — including the idle callback and its
  // timeout. Initing there would bill a $pageview to a visit nobody made. Chrome
  // exposes `document.prerendering` for exactly this: hold off, and re-enter on
  // `prerenderingchange`, which fires when the page is actually activated.
  if ((document as Document & { prerendering?: boolean }).prerendering) {
    document.addEventListener('prerenderingchange', scheduleInit, {
      once: true,
    })
    return
  }

  // The { timeout } is a HARD ceiling: if the browser hasn't gone idle within 2s,
  // it runs anyway. Analytics never waits indefinitely on a busy main thread,
  // while init stays off the LCP/INP critical path in the common (idle-soon)
  // case.
  const cancelIdle = onIdle(initPosthog, 2000)

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
    cancelIdle()
    void initPosthog()
    for (const e of events) window.removeEventListener(e, onFirstGesture, true)
  }
  for (const e of events) window.addEventListener(e, onFirstGesture, true)
}

if (analyticsEnabled()) {
  // Don't load or init eagerly — schedule both off the critical path (see
  // scheduleInit). Call sites are safe in the meantime: ph() queues anything
  // captured before the module lands and replays it in order afterwards.
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
  const lastUrl = useRef<string | null>(null)

  useEffect(() => {
    if (!pathname || !initialized) return
    let url = window.origin + pathname
    const qs = searchParams?.toString()
    if (qs) url += `?${qs}`
    if (lastUrl.current === url) return
    lastUrl.current = url
    ph((posthog) => posthog.capture('$pageview', { $current_url: url }))
  }, [pathname, searchParams])

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
      ph((posthog) => posthog.setPersonProperties({ pwa_installed: true }))
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

/**
 * Reports the one infrastructure failure the app is deliberately silent about:
 * the primary image CDN going down (a spent ImageKit quota fails every image
 * for the rest of the month). The fallback chain keeps the pictures on screen,
 * which is the whole point — and also why nobody would notice.
 *
 * Subscribing here rather than from BlurredImage means ONE listener regardless
 * of how many images are mounted, so the event fires exactly once per session
 * without a second "have I reported this yet" flag to keep in sync.
 */
function ImageHostTracker() {
  useEffect(() => subscribePrimaryImageHost(trackImageHostFallback), [])
  return null
}

/**
 * Mounts the PostHog side-effect components. There's no React context provider
 * here on purpose: posthog-js/react's <PostHogProvider> takes the singleton as a
 * prop, which would mean importing posthog-js statically and pulling all 221KB
 * of it onto the critical path — the exact cost lib/posthog-client exists to
 * avoid. The context was only ever read by one usePostHog() call, now a ph().
 */
export function CSPostHogProvider({ children }: PropsWithChildren) {
  return (
    <>
      <SuspendedPageView />
      <PostHogIdentity />
      <PwaInstallTracker />
      <ImageHostTracker />
      {children}
    </>
  )
}
