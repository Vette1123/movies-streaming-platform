'use client'

import React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Volume2, VolumeX } from 'lucide-react'

interface HeroTrailerPreviewProps {
  trailerKey: string
  // The parent slide owns the hover intent (it already pauses autoplay on
  // hover); this just reacts to it.
  active: boolean
  title?: string
}

// Muted, looping trailer that fades in over the backdrop while the slide is
// hovered on a real pointer device — the Netflix "preview on hover" beat. Only
// mounts the YouTube iframe while active, so nothing loads until the user
// actually lingers, and unmounts the moment they leave.
export function HeroTrailerPreview({
  trailerKey,
  active,
  title,
}: HeroTrailerPreviewProps) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          className="pointer-events-none absolute inset-0 z-[5] overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        >
          {/* Inner mounts only while active, so its mute state resets to true on
              every open — no lingering audio state, and no reset effect. */}
          <PreviewFrame trailerKey={trailerKey} title={title} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function PreviewFrame({
  trailerKey,
  title,
}: {
  trailerKey: string
  title?: string
}) {
  const [muted, setMuted] = React.useState(true)

  const src =
    `https://www.youtube-nocookie.com/embed/${trailerKey}` +
    `?autoplay=1&mute=${muted ? 1 : 0}&controls=0&loop=1&playlist=${trailerKey}` +
    `&rel=0&modestbranding=1&playsinline=1&disablekb=1&fs=0`

  return (
    <>
      {/* Oversize + center the iframe so a 16:9 video covers the frame with no
          letterbox bars, mimicking object-cover. */}
      <iframe
        key={muted ? 'muted' : 'unmuted'}
        src={src}
        title={title ? `${title} trailer preview` : 'Trailer preview'}
        allow="autoplay; encrypted-media"
        className="absolute top-1/2 left-1/2 h-[135vw] max-h-[none] w-[240vh] max-w-[none] -translate-x-1/2 -translate-y-1/2 border-0"
      />
      <button
        type="button"
        // Re-enable clicks just for the mute toggle.
        onClick={() => setMuted((m) => !m)}
        aria-label={muted ? 'Unmute trailer' : 'Mute trailer'}
        className="pointer-events-auto absolute right-4 bottom-24 z-10 flex size-10 items-center justify-center rounded-full border border-white/25 bg-black/40 text-white backdrop-blur-md transition hover:bg-black/60 lg:bottom-16"
      >
        {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
      </button>
    </>
  )
}
