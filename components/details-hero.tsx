import React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'

import { MovieDetails } from '@/types/movie-details'
import { SeriesDetails } from '@/types/series-details'
import { STREAM_EMBED_ALLOW } from '@/lib/embed-policy'
import { getMediaTitle } from '@/lib/media'
import { cn } from '@/lib/utils'
import { HeroImage } from '@/components/header/hero-image'
import { PlayButton } from '@/components/play-button'
import { SaveButton } from '@/components/save-button'
import { ShareButton } from '@/components/share-button'
import { TrailerDialog } from '@/components/trailer-dialog'
import { WatchedButton } from '@/components/watched-button'

// Muted caption under each action button; mobile-only (buttons show their own
// text label at sm+). Fixed width so two-word captions wrap under the pill.
const captionClass =
  'w-14 text-center text-[10px] leading-tight text-white/55 sm:hidden'

// The embed is driven by a `src` STRING, not by writing `.src` on a ref.
//
// It used to be a forwarded ref, and both callers guarded their play handler
// with `if (!iframeRef.current) return`. When that guard failed there was no
// state change and no DOM mutation at all, so pressing play did nothing —
// silently, with the analytics event already fired. Production caught it:
// `media_played` at 08:58:06.103 followed by a `$dead_click` on the same play
// icon 31ms later, no mutation in between.
//
// A prop cannot be null at the wrong moment. Passing a src both shows the embed
// and points it somewhere, so "play did nothing" is no longer expressible: the
// only way to not play is to not set a src. Re-setting the SAME src is a React
// no-op, which is exactly the don't-restart-playback behaviour the old
// playedKey guard was hand-rolling around the imperative write.
export const DetailsHero = ({
  movie,
  src,
  playVideo,
  series,
  trailerKey,
  playTarget,
  isResume,
  resumeSlot,
}: {
  movie?: MovieDetails
  series?: SeriesDetails
  /** Embed URL. Empty/undefined until the visitor presses play. */
  src?: string
  playVideo: () => void
  trailerKey?: string
  // Series only. `playTarget` is the episode pressing play will start (a
  // ?season/?episode deep-link, else continue-watching) and retargets the
  // play button's event + watch-history write; `isResume` says that target
  // came from stored progress rather than the URL; `resumeSlot` renders the
  // caption and progress bar under the button. All undefined for movies,
  // which have no episode to resume.
  playTarget?: { season: number; episode: number } | null
  isResume?: boolean
  resumeSlot?: React.ReactNode
}) => {
  const media = (movie || series) as MovieDetails & SeriesDetails
  const title = getMediaTitle(media)
  const isMovie = !!movie
  const isIframeShown = !!src

  // Bridge the blank gap between "Watch" click and the streaming iframe painting
  // its first frame: show a spinner while the iframe is shown but hasn't loaded.
  //
  // Stores WHICH src has painted rather than a loaded/not-loaded boolean, so the
  // spinner re-arms for the next episode by construction — the flag no longer
  // needs an effect to reset it when the src changes, which is both a render
  // fewer and one less way for the two to disagree.
  const [loadedSrc, setLoadedSrc] = React.useState<string | null>(null)
  const iframeLoaded = !!src && loadedSrc === src

  // Hero fills exactly one viewport and never exceeds it — the whole hero is
  // visible on load with no scroll to see the buttons, and no oversized band
  // pushing content down. Uses 100svh (small viewport height), NOT dvh: dvh is
  // dynamic and re-resolves as the mobile URL bar hides/shows on scroll, which
  // resizes the hero and reflows the page (visible jitter). svh is fixed to the
  // URL-bar-visible height, so the hero never recalculates while scrolling.
  // Inline height (not a Tailwind class) so it can't be dropped from the CSS
  // bundle; object-cover fills the box edge-to-edge (a little crop on the 16:9
  // backdrop is the trade for fitting the viewport).
  return (
    <section
      className="relative isolate w-full overflow-hidden"
      style={{ height: '100svh' }}
    >
      <HeroImage movie={media} priority />
      <div className="relative z-50 container h-full max-w-(--breakpoint-2xl)">
        <div className="flex h-full items-center justify-center">
          <AnimatePresence>
            {!isIframeShown && (
              <motion.div
                transition={{ type: 'spring', stiffness: 500 }}
                initial={{ opacity: 0, y: 80 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -150 }}
                // absolute, NOT in flow — this is the layout shift on "Watch".
                // The button stack and the iframe are siblings in one centered
                // flex box, so for the ~300ms the exit animation was still
                // running BOTH were laid out: the iframe was sized next to a
                // stack that was on its way out, then snapped to full width the
                // frame it unmounted. Taking the outgoing stack out of flow
                // means the iframe gets the whole box from the moment it
                // appears, and the exit animates over the top of it — the video
                // never moves.
                className="absolute inset-0 flex flex-col items-center justify-center gap-4 sm:gap-5"
              >
                <PlayButton
                  onClick={playVideo}
                  media={media}
                  target={playTarget}
                  isResume={isResume}
                />
                {resumeSlot}
                {/* Buttons are icon-only < sm, so pair each with a muted caption
                    (mobile only) that names what it does. */}
                <div className="flex flex-wrap items-start justify-center gap-2 sm:items-center sm:gap-3">
                  {trailerKey && (
                    <div className="flex flex-col items-center gap-1.5">
                      <TrailerDialog
                        trailerKey={trailerKey}
                        mediaId={media?.id}
                        mediaType={isMovie ? 'movie' : 'tv'}
                        title={title}
                      />
                      <span className={captionClass}>Play trailer</span>
                    </div>
                  )}
                  <div className="flex flex-col items-center gap-1.5">
                    <SaveButton media={media} />
                    <span className={captionClass}>Add to list</span>
                  </div>
                  {/* Whole-series "watched" is ambiguous (many episodes), so the
                      movie-level toggle only shows for movies; series completion
                      is tracked per-episode in the episode list. */}
                  {isMovie && movie && (
                    <div className="flex flex-col items-center gap-1.5">
                      <WatchedButton movie={movie} />
                      <span className={captionClass}>Watched</span>
                    </div>
                  )}
                  <div className="flex flex-col items-center gap-1.5">
                    <ShareButton
                      title={title}
                      mediaId={media?.id}
                      mediaType={isMovie ? 'movie' : 'tv'}
                    />
                    <span className={captionClass}>Share</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {isIframeShown && !iframeLoaded && (
            <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center">
              <Loader2 className="size-12 animate-spin text-white/80" />
            </div>
          )}
          <iframe
            className={cn('size-full py-20', {
              hidden: !isIframeShown,
            })}
            allowFullScreen
            // Left undefined until play, so the embed is never requested on
            // load. Re-rendering with the SAME string is a no-op for React,
            // which is what keeps pressing play on the already-playing episode
            // from restarting it.
            src={src || undefined}
            autoFocus
            onLoad={() => setLoadedSrc(src ?? null)}
            content="noindex,nofollow"
            autoSave={title?.toLowerCase().trim()}
            id={title}
            name={title}
            title={title}
            about={media?.overview}
            key={media?.id}
            // The embed is a third party we do not control, funded by ads.
            // There is deliberately NO `sandbox` here — the provider refuses
            // to load inside one at all. See lib/embed-policy.ts before
            // adding it back.
            allow={STREAM_EMBED_ALLOW}
          ></iframe>
        </div>
      </div>
      <div className="pointer-events-none absolute -inset-4 rounded-md bg-gradient-to-b from-slate-900/45 via-slate-900/10 to-slate-900/40 shadow-[inset_0_1px_0_0_rgba(148,163,184,0.1)] transition motion-reduce:transition-none lg:-inset-x-6 lg:block lg:drop-shadow-lg" />
    </section>
  )
}
