'use client'

import React from 'react'
import { usePathname } from 'next/navigation'
import { Download, Share, X } from 'lucide-react'

import { useMounted } from '@/hooks/use-mounted'
import { usePwaInstall } from '@/hooks/use-pwa-install'

const DISMISS_KEY = 'reely-pwa-install-dismissed'

/** Routes that own the whole viewport. A floating bar over a full-bleed reel
 * is not "unobtrusive" - it sits on the video, and in focus mode it is the
 * only thing on screen that is not the film. */
const IMMERSIVE_ROUTES = ['/reels']

// Reads through a guard: localStorage throws in private mode / when storage is
// blocked, and a nudge is never worth taking the page down over.
const wasDismissed = () => {
  try {
    return Boolean(window.localStorage.getItem(DISMISS_KEY))
  } catch {
    return true
  }
}

/**
 * Lightweight, one-time, dismissible install nudge. On Android/Chrome it fires
 * the deferred `beforeinstallprompt`; on iOS (which has no such event) it shows
 * the Share → Add to Home Screen hint. Never shows once installed or after the
 * user dismisses it (remembered in localStorage). Deliberately unobtrusive — a
 * single bottom bar, no nagging. The install action itself lives in the shared
 * `usePwaInstall` hook, so the sidebar / command menu can install even after
 * this nudge is dismissed.
 */
export function InstallPrompt() {
  const { canPrompt, needsIosHint, promptInstall } = usePwaInstall()
  const [dismissedNow, setDismissedNow] = React.useState(false)
  // localStorage is client-only, so the stored flag can't be read during the
  // server render. Gating on mount keeps the server HTML and the first client
  // render identical (both render nothing) without syncing storage into state
  // through an effect, which cost an extra render pass on every page.
  const isMounted = useMounted()
  const pathname = usePathname()

  const remember = React.useCallback(() => {
    setDismissedNow(true)
    try {
      window.localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // storage blocked — the nudge still hides for this session
    }
  }, [])

  const install = React.useCallback(async () => {
    await promptInstall()
    remember()
  }, [promptInstall, remember])

  if (!isMounted) return null
  if (IMMERSIVE_ROUTES.some((route) => pathname?.startsWith(route))) return null
  if (dismissedNow || wasDismissed()) return null
  if (!canPrompt && !needsIosHint) return null

  return (
    <div className="pwa-install-prompt animate-in slide-in-from-bottom-4 fade-in fixed inset-x-3 bottom-3 z-[70] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-white/15 bg-[rgba(10,12,20,0.82)] px-4 py-3 shadow-[0_10px_40px_rgba(0,0,0,0.55)] backdrop-blur-md backdrop-saturate-150 duration-500 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2">
      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-cyan-300 to-cyan-500 text-[#04121a]">
        <Download className="size-5" strokeWidth={2.5} aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white">Install Reely</p>
        {needsIosHint ? (
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
      {!needsIosHint && (
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
        onClick={remember}
        aria-label="Dismiss"
        className="grid size-7 shrink-0 place-items-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  )
}
