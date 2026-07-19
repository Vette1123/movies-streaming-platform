'use client'

import React from 'react'
import { AnimatePresence, motion } from 'framer-motion'

interface HeroTrailerPreviewProps {
  trailerKey: string
  // The parent slide owns the hover intent (it already pauses autoplay on
  // hover); this just reacts to it.
  active: boolean
  title?: string
  // Muted state is owned by the parent slide so its mute button can live at the
  // top-level z layer — see the note in hero-slide.tsx. This just reflects it.
  muted: boolean
}

// Muted, looping trailer that fades in over the backdrop while the slide is
// hovered on a real pointer device — the Netflix "preview on hover" beat. Only
// mounts the YouTube iframe while active, so nothing loads until the user
// actually lingers, and unmounts the moment they leave.
export function HeroTrailerPreview({
  trailerKey,
  active,
  title,
  muted,
}: HeroTrailerPreviewProps) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
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
          <PreviewFrame trailerKey={trailerKey} title={title} muted={muted} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function PreviewFrame({
  trailerKey,
  title,
  muted,
}: {
  trailerKey: string
  title?: string
  muted: boolean
}) {
  const iframeRef = React.useRef<HTMLIFrameElement>(null)

  // Always start MUTED (browsers only allow autoplay when muted) and enable the
  // YouTube IFrame API. Mute is then toggled live via postMessage below — the
  // src never changes and the iframe never remounts, so toggling sound does NOT
  // restart the trailer. (The old approach keyed the iframe on `muted`, which
  // reloaded the video from 0 on every toggle.)
  const src =
    `https://www.youtube-nocookie.com/embed/${trailerKey}` +
    `?autoplay=1&mute=1&controls=0&loop=1&playlist=${trailerKey}` +
    `&rel=0&modestbranding=1&playsinline=1&disablekb=1&fs=0&enablejsapi=1`

  // Sync mute state to the running player without reloading it. The toggle is
  // user-initiated, so the gesture carries into unMute and audio is allowed.
  React.useEffect(() => {
    const win = iframeRef.current?.contentWindow
    if (!win) return
    win.postMessage(
      JSON.stringify({
        event: 'command',
        func: muted ? 'mute' : 'unMute',
        args: [],
      }),
      '*'
    )
  }, [muted])

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
