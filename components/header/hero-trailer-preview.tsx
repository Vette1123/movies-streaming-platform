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
  // Coarse-pointer (touch) device — no hover, no cursor. Full view uses a
  // simpler gesture there: tap the film to play/pause directly, with exit + mute
  // pinned. Desktop keeps the summon-a-center-button flow. Mirrors the slide's
  // `hasHover`.
  touch?: boolean
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
    touch,
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
              hidden while this subtree owns the screen). They auto-hide during
              playback (see FullscreenControls) so full view stays a clean,
              chrome-free "focus on the play". No YouTube chrome either. */}
          {fullscreen && (
            <FullscreenControls
              paused={!!paused}
              muted={muted}
              touch={!!touch}
              onTogglePlay={onTogglePlay}
              onToggleMute={onToggleMute}
              onExitFullscreen={onExitFullscreen}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
})

// Auto-hiding full-view controls. In full view the trailer is the whole point,
// so the chrome shouldn't sit on top of it.
//
// TOUCH (mobile): the whole film is the play/pause button — tap anywhere to
// toggle, no center button, nothing to summon. Exit + mute stay pinned top-right
// (dimmed) so they're always reachable. This is the entire mobile behaviour; the
// desktop machinery below never runs.
//
// DESKTOP (hover + fine pointer), like a real player:
//   • enter full view → controls flash in, then fade out after a short idle
//   • tap / click the film → toggle them (summon or dismiss on demand)
//   • while PAUSED they stay pinned — the Play button must always be reachable
// Deliberately NOT wired to pointermove: on desktop a mouse jitters constantly,
// which kept re-summoning the controls so they never actually hid ("I still see
// the play/pause"). Click-to-toggle is the single gesture. The cursor hides with
// the controls so nothing floats over the film.
const IDLE_MS = 2600

type FullViewControlsProps = {
  paused: boolean
  muted: boolean
  touch: boolean
  onTogglePlay?: () => void
  onToggleMute?: () => void
  onExitFullscreen?: () => void
}

// Two distinct full-view behaviours; pick one. Kept as separate components (not
// one body with an early return) so neither ends up calling hooks conditionally.
function FullscreenControls(props: FullViewControlsProps) {
  return props.touch ? (
    <TouchFullscreenControls {...props} />
  ) : (
    <DesktopFullscreenControls {...props} />
  )
}

// Touch: the whole film IS the play/pause button — tap anywhere to toggle. No
// timers, no center button, no summon flow. Exit + mute stay pinned top-right.
function TouchFullscreenControls({
  muted,
  onTogglePlay,
  onToggleMute,
  onExitFullscreen,
}: FullViewControlsProps) {
  return (
    <div
      // pointer-events-auto: the cover is pointer-events-none, so this layer
      // catches the tap. A tap anywhere on the film toggles play/pause.
      className="pointer-events-auto absolute inset-0 z-[65]"
      onClick={() => onTogglePlay?.()}
    >
      {/* Pinned mute + exit, top-right. Dimmed so they sit quietly over the
          film; stopPropagation so pressing them doesn't also toggle play. */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onToggleMute?.()
        }}
        aria-label={muted ? 'Unmute' : 'Mute'}
        aria-pressed={!muted}
        className="pointer-events-auto absolute top-5 right-[4.75rem] z-[70] flex size-11 items-center justify-center rounded-full border border-white/25 bg-black/50 text-white opacity-70 backdrop-blur-md transition active:opacity-100"
      >
        {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onExitFullscreen?.()
        }}
        aria-label="Exit full view"
        className="pointer-events-auto absolute top-5 right-5 z-[70] flex size-11 items-center justify-center rounded-full border border-white/25 bg-black/50 text-white opacity-70 backdrop-blur-md transition active:opacity-100"
      >
        <Minimize className="size-5" />
      </button>
    </div>
  )
}

// Desktop: auto-hiding controls with a center play/pause button.
function DesktopFullscreenControls({
  paused,
  muted,
  onTogglePlay,
  onToggleMute,
  onExitFullscreen,
}: FullViewControlsProps) {
  const [visible, setVisible] = React.useState(true)
  const hideTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = React.useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = null
  }, [])

  // Arm the fade-out — but never while paused (you'd hide the only way to
  // resume). Every call restarts the countdown, so activity keeps them alive.
  const scheduleHide = React.useCallback(() => {
    clearTimer()
    if (paused) return
    hideTimer.current = setTimeout(() => setVisible(false), IDLE_MS)
  }, [paused, clearTimer])

  const reveal = React.useCallback(() => {
    setVisible(true)
    scheduleHide()
  }, [scheduleHide])

  // While paused the controls are always shown (derived, not stored) so the
  // Play button is never hidden behind an idle timeout — no setState needed.
  const shown = paused || visible

  // Playing → start the fade countdown; paused → cancel it. Fires on mount too,
  // so controls greet you on entering full view and then settle away.
  React.useEffect(() => {
    if (paused) clearTimer()
    else scheduleHide()
    return clearTimer
  }, [paused, scheduleHide, clearTimer])

  // A tap/click on the film toggles the controls — the ONLY way to summon them
  // (no pointermove reveal; see the note above).
  const onBackdropClick = React.useCallback(() => {
    setVisible((v) => {
      if (v) {
        clearTimer()
        return false
      }
      scheduleHide()
      return true
    })
  }, [scheduleHide, clearTimer])

  return (
    <div
      // pointer-events-auto: the cover itself is pointer-events-none, so this
      // layer is what actually catches taps/moves to summon the controls.
      className={`pointer-events-auto absolute inset-0 z-[65] ${shown ? '' : 'cursor-none'}`}
      onClick={onBackdropClick}
    >
      <AnimatePresence>
        {shown && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {/* Centered play/pause. */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onTogglePlay?.()
                reveal()
              }}
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
              onClick={(e) => {
                e.stopPropagation()
                onToggleMute?.()
                reveal()
              }}
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
              onClick={(e) => {
                e.stopPropagation()
                onExitFullscreen?.()
              }}
              aria-label="Exit full view"
              className="pointer-events-auto absolute top-5 right-5 z-[70] flex size-11 items-center justify-center rounded-full border border-white/25 bg-black/50 text-white backdrop-blur-md transition hover:bg-black/70"
            >
              <Minimize className="size-5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

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
    win.postMessage(JSON.stringify({ event: 'command', func, args: [] }), '*')
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
