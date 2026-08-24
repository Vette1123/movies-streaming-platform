import React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'

import { MovieDetails } from '@/types/movie-details'
import { SeriesDetails } from '@/types/series-details'
import { REELY_SOURCE_ID } from '@/config/sources'
import { STREAM_EMBED_ALLOW } from '@/lib/embed-policy'
import { getMediaTitle } from '@/lib/media'
import { warmReelyTicket } from '@/lib/pro/ticket-cache'
import { cn } from '@/lib/utils'
import { useIntentProps } from '@/hooks/use-prefetch-intent'
import { type StreamSourceControl } from '@/hooks/use-stream-source'
import { HeroImage } from '@/components/header/hero-image'
import { PlayButton } from '@/components/play-button'
import { EmbedProgressBridge } from '@/components/player/embed-progress-bridge'
import { ReelyPlayer } from '@/components/player/reely-player'
import { SourceSwitcher } from '@/components/player/source-switcher'
import { RateButton } from '@/components/rate-button'
import { SaveButton } from '@/components/save-button'
import { ShareButton } from '@/components/share-button'
import { TrailerDialog } from '@/components/trailer-dialog'
import { WatchTogetherBar } from '@/components/watch-together-bar'
import { WatchedButton } from '@/components/watched-button'

// Caption under each action button; mobile-only (buttons show their own text
// label at sm+). Fixed width so two-word captions wrap under the pill.
//
// Near-white with the same drop shadow the pill labels carry, not a muted grey:
// this sits directly on the backdrop image, where a 55%-white 10px label lands
// somewhere between 1.5:1 and 3:1 depending entirely on which frame is behind
// it. The shadow is what makes it legible over a bright still — opacity alone
// cannot be tuned for an image nobody chose.
const captionClass =
  'w-14 text-center text-[10px] leading-tight font-medium text-white/90 [text-shadow:0_1px_3px_rgba(0,0,0,0.85)] sm:hidden'

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
  sourceControl,
  selfHost,
}: {
  movie?: MovieDetails
  series?: SeriesDetails
  /** Embed URL. Empty/undefined until the visitor presses play. */
  src?: string
  playVideo: () => void
  trailerKey?: string
  /**
   * Which server is playing, and how to move off one that will not. Rendered
   * only while something is playing, because that is the only moment the
   * question exists. See use-stream-source.
   */
  sourceControl?: StreamSourceControl
  // Series only. `playTarget` is the episode pressing play will start (a
  // ?season/?episode deep-link, else continue-watching) and retargets the
  // play button's event + watch-history write; `isResume` says that target
  // came from stored progress rather than the URL; `resumeSlot` renders the
  // caption and progress bar under the button. All undefined for movies,
  // which have no episode to resume.
  playTarget?: { season: number; episode: number } | null
  isResume?: boolean
  resumeSlot?: React.ReactNode
  /**
   * What the Reely Player would play. Title/year ride along for the
   * external-subtitle catalogs; season/episode for shows. Rendered whenever
   * the active source is `reely` — no query param involved, the source
   * switcher is what decides.
   */
  selfHost?: {
    type: 'movie' | 'tv'
    id: number
    season?: number
    episode?: number
    title?: string
    year?: number
    imdb?: string
  } | null
}) => {
  const media = (movie || series) as MovieDetails & SeriesDetails
  const title = getMediaTitle(media)
  const isMovie = !!movie
  const isIframeShown = !!src

  // While something is playing, the page is the player. The PWA nudge is
  // fixed to the bottom of the viewport and measurably sat on top of the
  // embed's own scrubber and our source buttons, so it steps aside for the
  // duration - one attribute, read by a CSS rule next to the prompt itself.
  React.useEffect(() => {
    if (!isIframeShown) return
    document.body.dataset.playerOpen = '1'
    return () => {
      delete document.body.dataset.playerOpen
    }
  }, [isIframeShown])

  // Which surface is playing: our player when the active source says so, the
  // third-party embed otherwise. The embed's `src` is still set by the caller
  // in reely mode (it is meaningless there and never used as a frame URL).
  const reelyIsTheSource =
    !!selfHost && sourceControl?.source.id === REELY_SOURCE_ID
  const useReely = isIframeShown && reelyIsTheSource

  // The ticket is the one link in the chain that can be paid for BEFORE the
  // tap: mint it while the thumb is still travelling and the player boots
  // straight into the shell instead of waiting on a round trip of ours first.
  const warmTicket = React.useCallback(() => {
    if (reelyIsTheSource && selfHost) warmReelyTicket(selfHost)
  }, [reelyIsTheSource, selfHost])
  const playIntent = useIntentProps(warmTicket)

  // If the house player cannot start — ticket refused once PRO_PLAYER_OPEN is
  // lifted, or the worker not configured — fall back to the first embed and
  // let the switcher reflect it, exactly like a stalled server would.
  const onReelyUnavailable = React.useCallback(() => {
    if (!sourceControl) return
    const fallback = sourceControl.sources.find((s) => s.id !== REELY_SOURCE_ID)
    if (fallback) sourceControl.select(fallback.id)
  }, [sourceControl])

  // Bridge the blank gap between "Watch" click and the streaming iframe painting
  // its first frame: show a spinner while the iframe is shown but hasn't loaded.
  //
  // Stores WHICH src has painted rather than a loaded/not-loaded boolean, so the
  // spinner re-arms for the next episode by construction — the flag no longer
  // needs an effect to reset it when the src changes, which is both a render
  // fewer and one less way for the two to disagree.
  const [loadedSrc, setLoadedSrc] = React.useState<string | null>(null)
  const iframeLoaded = !!src && loadedSrc === src
  // The embed frame, for the progress bridge's source-window identity check.
  const iframeRef = React.useRef<HTMLIFrameElement>(null)
  // The house player's frame. Watch Together has to steer whichever of the two
  // is actually on screen.
  const reelyFrameRef = React.useRef<HTMLIFrameElement>(null)

  // Watch Together rides along when the URL carries the room (?watch=CODE).
  // Read at render with a window guard, not useSearchParams: this hero
  // prerenders ~1000 times at build, and a searchParams read at render would
  // deopt every one of them. The bar only mounts after a client-side play
  // click, so the server/client snapshot difference never reaches the DOM.
  const together = React.useMemo(() => {
    if (typeof window === 'undefined') return null
    const params = new URLSearchParams(window.location.search)
    const code = params.get('watch')
    return code ? { code, isHost: params.get('host') === '1' } : null
  }, [])

  // The reely surface reports readiness with its own pseudo-src so the stall
  // detector and the spinner treat both surfaces identically.
  const key = `${selfHost?.type ?? ''}:${selfHost?.id ?? ''}:${selfHost?.season ?? ''}:${selfHost?.episode ?? ''}`
  const reelyLoaded = useReely && loadedSrc === `reely:${key}`
  const shownLoaded = useReely ? reelyLoaded : iframeLoaded

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
                // On the stack, not the button: a touch anywhere in it bubbles
                // up here, and the resume control leads to the same player.
                {...playIntent}
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
                  <div className="flex flex-col items-center gap-1.5">
                    <RateButton media={media} />
                    <span className={captionClass}>Rate it</span>
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
          {useReely && selfHost ? (
            // Same centered slot the embed occupies; inset by py-20 for the
            // same reason — clear of the sticky header above and the install
            // prompt's contested bottom edge.
            <div className="relative size-full py-20">
              <ReelyPlayer
                target={selfHost}
                onReady={() => setLoadedSrc(`reely:${key}`)}
                onUnavailable={onReelyUnavailable}
                frameRef={reelyFrameRef}
              />
              {!reelyLoaded && (
                <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center">
                  <Loader2 className="size-12 animate-spin text-white/80" />
                </div>
              )}
            </div>
          ) : (
            <>
              {isIframeShown && !iframeLoaded && (
                <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center">
                  <Loader2 className="size-12 animate-spin text-white/80" />
                </div>
              )}
              <iframe
                ref={iframeRef}
                className={cn('size-full py-20', {
                  hidden: !isIframeShown,
                })}
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
              {isIframeShown && (
                // Progress out of embeds that publish it. Mounted only while
                // playing; trusts the frame URL's own origin (never a
                // hard-coded host) and the frame's own window.
                <EmbedProgressBridge
                  src={src}
                  type={isMovie ? 'movie' : 'tv'}
                  id={media.id}
                  season={selfHost?.season}
                  episode={selfHost?.episode}
                  frameRef={iframeRef}
                />
              )}
            </>
          )}
          {/* Mounted whether or not the player is open: the room is what the
              URL says, and a host who has not pressed play yet still needs the
              invite to send. Before play the guest loop has no frame to steer
              and simply idles. */}
          {together && (
            <WatchTogetherBar
              code={together.code}
              isHost={together.isHost}
              frameRef={useReely ? reelyFrameRef : iframeRef}
            />
          )}
          {isIframeShown && sourceControl && !useReely && (
            // Above the frame, not below it. Two things already live along the
            // bottom edge — the embed's own scrubber, and the install prompt,
            // which measurably sat on top of these buttons and swallowed the
            // click. The band above the frame is empty on every viewport,
            // because the iframe is inset by py-20 — offset clear of the sticky header,
            // which sits above this and was eating the click at top-4.
            <div className="pointer-events-none absolute inset-x-0 top-20 z-50 flex justify-center px-4">
              <SourceSwitcher control={sourceControl} loaded={shownLoaded} />
            </div>
          )}
        </div>
      </div>
      <div className="pointer-events-none absolute -inset-4 rounded-md bg-gradient-to-b from-slate-900/45 via-slate-900/10 to-slate-900/40 shadow-[inset_0_1px_0_0_rgba(148,163,184,0.1)] transition motion-reduce:transition-none lg:-inset-x-6 lg:block lg:drop-shadow-lg" />
    </section>
  )
}
