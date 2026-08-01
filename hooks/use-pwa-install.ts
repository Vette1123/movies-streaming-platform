'use client'

import * as React from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// Chrome fires `beforeinstallprompt` once, early, and only once. We capture it
// in module scope so *any* surface (the auto nudge, the sidebar entry, the
// command menu) can trigger install later — not just whichever component
// happened to be mounted when the event fired. Subscribers re-render via the
// listener set below.
let deferred: BeforeInstallPromptEvent | null = null
let installed = false
const subscribers = new Set<() => void>()

function emit() {
  subscribers.forEach((fn) => fn())
}

function bindOnce() {
  if (typeof window === 'undefined') return
  const w = window as Window & { __reelyInstallBound?: boolean }
  if (w.__reelyInstallBound) return
  w.__reelyInstallBound = true

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as BeforeInstallPromptEvent
    emit()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    installed = true
    emit()
  })
}

// Bind at module load (client only) so we miss as few early events as possible.
bindOnce()

export function isStandalone() {
  if (typeof window === 'undefined') return false
  const displayStandalone = window.matchMedia?.(
    '(display-mode: standalone)'
  ).matches
  // iOS Safari exposes navigator.standalone instead of the display-mode query.
  const iosStandalone = (
    window.navigator as Navigator & { standalone?: boolean }
  ).standalone
  return Boolean(displayStandalone || iosStandalone)
}

export function isIos() {
  if (typeof window === 'undefined') return false
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
}

export type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable'

export interface PwaInstall {
  /** Native prompt is armed (Android/Chromium) and app not yet installed. */
  canPrompt: boolean
  /** iOS has no prompt event — surface the manual Share → Add hint instead. */
  needsIosHint: boolean
  /** Anything worth showing an "Install" affordance for. */
  canInstall: boolean
  standalone: boolean
  promptInstall: () => Promise<InstallOutcome>
}

/**
 * Shared PWA-install state. Returns whether an install affordance should show
 * and a `promptInstall()` that fires the native dialog (Android/Chromium).
 */
export function usePwaInstall(): PwaInstall {
  bindOnce()
  const [, force] = React.useReducer((n: number) => n + 1, 0)

  React.useEffect(() => {
    subscribers.add(force)
    return () => {
      subscribers.delete(force)
    }
  }, [])

  const standalone = isStandalone()
  const ios = isIos()
  const canPrompt = !!deferred && !installed && !standalone
  const needsIosHint = ios && !standalone && !installed

  const promptInstall = React.useCallback(async (): Promise<InstallOutcome> => {
    const evt = deferred
    if (!evt) return 'unavailable'
    await evt.prompt()
    const { outcome } = await evt.userChoice
    deferred = null
    emit()
    return outcome
  }, [])

  return {
    canPrompt,
    needsIosHint,
    canInstall: canPrompt || needsIosHint,
    standalone,
    promptInstall,
  }
}
