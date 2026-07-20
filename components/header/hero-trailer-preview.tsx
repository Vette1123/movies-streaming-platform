'use client'

import React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Minimize, Pause, Play, Volume2, VolumeX } from 'lucide-react'

interface HeroTrailerPreviewProps {
  trailerKey: string
  // The parent slide owns the hover intent (it already pauses autoplay on
  // hover); this just reacts to it.
  active: boolean
  title?: string
  // Muted state is owned by the parent slide so its mute button can live at the
  // top-level z layer — see the note in hero-slide.tsx. This just reflects it.
  muted: boolean
  // True while this cover is the native-fullscreen element. In fullscreen the
  // page chrome is gone (only THIS subtree renders), so full-view controls (exit
  // + play/pause) have to live inside here — it's the only affordance out
  // besides Esc.
  fullscreen?: boolean
  // Paused state, owned by the parent so the spacebar shortcut can drive it too.
  paused?: boolean
  onExitFullscreen?: () => void
  onTogglePlay?: () => void
  onToggleMute?: () => void
}

// Muted, looping trailer that fades in over the backdrop while the slide is the
// on-screen one. Only mounts the YouTube iframe while active, so nothing loads
// until autoplay arms it. Forwards a ref to the cover element so the slide can
// request native fullscreen on it (full view).
export const HeroTrailerPreview = React.forwardRef<
  HTMLDivElement,
  HeroTrailerPreviewProps
>(function HeroTrailerPreview(
  {
    trailerKey,
    active,
    title,
    muted,
    fullscreen,
    paused,
    onExitFullscreen,
    onTogglePlay,
    onToggleMute,
  },
  ref
) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          ref={ref}
          // `.hero-trailer-cover` (globals.css) sets container-type + sizes the
          // iframe in cqw/cqh so the 16:9 video covers the hero at any height —
          // mobile (86svh) or desktop (100vh) — with no letterbox bars.
          // z-20 sits ABOVE the scrims (z-10) so the playing trailer reads bright
          // and clear (the "cinematic takeover"), but below the content (z-50)
          // and controls (z-60) so Watch/mute/autoplay stay on top and clickable.
          // pointer-events-none keeps clicks passing through to those controls.
          // This layer only mounts while the trailer is active, so the lift is
          // inherently scoped to playback — no state needed.
          className="hero-trailer-cover pointer-events-none absolute inset-0 z-20 overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        >
          <PreviewFrame
            trailerKey={trailerKey}
            title={title}
            muted={muted}
            paused={!!paused}
          />

          {/* Full-view controls — only in fullscreen. Inside the fullscreen
              element so they actually render there (siblings on the page are
              hidden while this subtree owns the screen). pointer-events-auto
              re-enables clicks on top of the cover's pointer-events-none. No
              YouTube chrome — just our own exit + play/pause. */}
          {fullscreen && (
            <>
              {/* Centered play/pause. */}
              <button
                type="button"
                onClick={onTogglePlay}
                aria-label={paused ? 'Play' : 'Pause'}
                className="pointer-events-auto absolute top-1/2 left-1/2 z-[70] flex size-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/40 text-white opacity-80 backdrop-blur-md transition hover:bg-black/60 hover:opacity-100"
              >
                {paused ? (
                  <Play className="size-9 translate-x-0.5 fill-current" />
                ) : (
                  <Pause className="size-9 fill-current" />
                )}
              </button>

              {/* Top-right: mute/unmute + exit, side by side. */}
              <button
                type="button"
                onClick={onToggleMute}
                aria-label={muted ? 'Unmute' : 'Mute'}
                aria-pressed={!muted}
                className="pointer-events-auto absolute top-5 right-[4.75rem] z-[70] flex size-11 items-center justify-center rounded-full border border-white/25 bg-black/50 text-white backdrop-blur-md transition hover:bg-black/70"
              >
                {muted ? (
                  <VolumeX className="size-5" />
                ) : (
                  <Volume2 className="size-5" />
                )}
              </button>
              <button
                type="button"
                onClick={onExitFullscreen}
                aria-label="Exit full view"
                className="pointer-events-auto absolute top-5 right-5 z-[70] flex size-11 items-center justify-center rounded-full border border-white/25 bg-black/50 text-white backdrop-blur-md transition hover:bg-black/70"
              >
                <Minimize className="size-5" />
              </button>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
})

function PreviewFrame({
  trailerKey,
  title,
  muted,
  paused,
}: {
  trailerKey: string
  title?: string
  muted: boolean
  paused: boolean
}) {
  const iframeRef = React.useRef<HTMLIFrameElement>(null)

  // Always start MUTED (browsers only allow autoplay when muted) and enable the
  // YouTube IFrame API. Mute and play/pause are then driven live via postMessage
  // below — the src never changes and the iframe never remounts, so toggling
  // sound or pausing does NOT restart the trailer. No native chrome (controls=0)
  // so full view can show our own minimal controls instead.
  const src =
    `https://www.youtube-nocookie.com/embed/${trailerKey}` +
    `?autoplay=1&mute=1&controls=0&loop=1&playlist=${trailerKey}` +
    `&rel=0&modestbranding=1&playsinline=1&disablekb=1&fs=0&enablejsapi=1`

  const command = React.useCallback((func: string) => {
    const win = iframeRef.current?.contentWindow
    if (!win) return
    win.postMessage(
      JSON.stringify({ event: 'command', func, args: [] }),
      '*'
    )
  }, [])

  // Sync mute state to the running player without reloading it. The toggle is
  // user-initiated, so the gesture carries into unMute and audio is allowed.
  React.useEffect(() => {
    command(muted ? 'mute' : 'unMute')
  }, [muted, command])

  // Sync play/pause the same way — postMessage, no reload.
  React.useEffect(() => {
    command(paused ? 'pauseVideo' : 'playVideo')
  }, [paused, command])

  // Sized to object-cover the hero via .hero-trailer-cover (globals.css).
  return (
    <iframe
      ref={iframeRef}
      src={src}
      title={title ? `${title} trailer preview` : 'Trailer preview'}
      allow="autoplay; encrypted-media"
    />
  )
}
