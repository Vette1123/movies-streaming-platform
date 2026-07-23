'use client'

import React from 'react'
import { Download, Share, X } from 'lucide-react'

const DISMISS_KEY = 'reely-pwa-install-dismissed'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalone() {
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

function isIos() {
  if (typeof window === 'undefined') return false
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
}

/**
 * Lightweight, one-time, dismissible install nudge. On Android/Chrome it defers
 * the native `beforeinstallprompt` and triggers it on tap; on iOS (which has no
 * such event) it shows the Share → Add to Home Screen hint. Never shows once the
 * app is already installed or after the user dismisses it (remembered in
 * localStorage). Deliberately unobtrusive — a single bottom bar, no nagging.
 */
export function InstallPrompt() {
  const [visible, setVisible] = React.useState(false)
  const [iosHint, setIosHint] = React.useState(false)
  const deferred = React.useRef<BeforeInstallPromptEvent | null>(null)

  React.useEffect(() => {
    if (isStandalone()) return
    if (window.localStorage.getItem(DISMISS_KEY)) return

    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      deferred.current = e as BeforeInstallPromptEvent
      setVisible(true)
    }
    const onInstalled = () => {
      setVisible(false)
      window.localStorage.setItem(DISMISS_KEY, '1')
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)

    // iOS never fires beforeinstallprompt — offer the manual hint instead.
    if (isIos()) {
      setIosHint(true)
      setVisible(true)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const dismiss = React.useCallback(() => {
    setVisible(false)
    window.localStorage.setItem(DISMISS_KEY, '1')
  }, [])

  const install = React.useCallback(async () => {
    const evt = deferred.current
    if (!evt) return
    await evt.prompt()
    await evt.userChoice
    deferred.current = null
    setVisible(false)
    window.localStorage.setItem(DISMISS_KEY, '1')
  }, [])

  if (!visible) return null

  return (
    <div className="animate-in slide-in-from-bottom-4 fade-in fixed inset-x-3 bottom-3 z-[70] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-white/15 bg-[rgba(10,12,20,0.82)] px-4 py-3 shadow-[0_10px_40px_rgba(0,0,0,0.55)] backdrop-blur-md backdrop-saturate-150 duration-500 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2">
      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-cyan-300 to-cyan-500 text-[#04121a]">
        <Download className="size-5" strokeWidth={2.5} aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white">Install Reely</p>
        {iosHint ? (
          <p className="flex items-center gap-1 text-xs text-white/70">
            Tap <Share className="inline size-3.5" aria-hidden /> then “Add to
            Home Screen”
          </p>
        ) : (
          <p className="text-xs text-white/70">
            Full-screen, fast, right on your home screen.
          </p>
        )}
      </div>
      {!iosHint && (
        <button
          type="button"
          onClick={install}
          className="shrink-0 rounded-lg bg-gradient-to-br from-cyan-300 to-cyan-500 px-3 py-1.5 text-sm font-semibold text-[#04121a] transition hover:brightness-105 active:scale-95"
        >
          Install
        </button>
      )}
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="grid size-7 shrink-0 place-items-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  )
}
