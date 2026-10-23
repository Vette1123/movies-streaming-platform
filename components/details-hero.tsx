import React, { useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ListVideo } from 'lucide-react'

import { MovieDetails } from '@/types/movie-details'
import { SeriesDetails } from '@/types/series-details'
import { REELY_SOURCE_ID } from '@/config/sources'
import { upcomingEpisode } from '@/lib/airing'
import { STREAM_EMBED_ALLOW } from '@/lib/embed-policy'
import { getMediaTitle } from '@/lib/media'
import { warmReelyTicket } from '@/lib/pro/ticket-cache'
import { cn } from '@/lib/utils'
import { REMOTE_KEY_PARAM } from '@/lib/watch-together'
import { useHasHoverPointer } from '@/hooks/use-device-tier'
import { useMagnetic } from '@/hooks/use-magnetic'
import { useMounted } from '@/hooks/use-mounted'
import { useIntentProps } from '@/hooks/use-prefetch-intent'
import { type StreamSourceControl } from '@/hooks/use-stream-source'
import { buttonVariants } from '@/components/ui/button'
import {
  heroActionButtonBase,
  heroActionButtonIdle,
  heroActionIconOnly,
} from '@/components/ui/hero-action-button'
import { AiringChip } from '@/components/airing-chip'
import { HeroImage } from '@/components/header/hero-image'
import { HeroRatesInfos } from '@/components/header/hero-rates-info'
import { HeroWordmark } from '@/components/header/hero-wordmark'
import { RatingsPills } from '@/components/media/ratings-strip'
import { NewBadgeWhenRecent } from '@/components/new-badge-when-recent'
import { PlayButton } from '@/components/play-button'
import { EmbedProgressBridge } from '@/components/player/embed-progress-bridge'
import { PlayerSettings } from '@/components/player/player-settings'
import { PlayerStage } from '@/components/player/player-stage'
import { ReelyPlayer } from '@/components/player/reely-player'
import { SourceSwitcher } from '@/components/player/source-switcher'
import { RateButton } from '@/components/rate-button'
import { SaveButton } from '@/components/save-button'
import { ShareButton } from '@/components/share-button'
import { ShareCardButton } from '@/components/share-card-button'
import { TogetherRemote } from '@/components/together-remote'
import { TrailerDialog } from '@/components/trailer-dialog'
import { WatchTogetherBar } from '@/components/watch-together-bar'
import { WatchedButton } from '@/components/watched-button'

// Caption for each secondary action. Below `sm` the actions are icon-only, so it
// is printed under the icon; from `sm` up it becomes a tooltip under the
// circle, shown on hover and on keyboard focus.
//
// Near-white with the same drop shadow the pill labels carry, not a muted grey:
// this sits directly on the backdrop image, where a 55%-white 10px label lands
// somewhere between 1.5:1 and 3:1 depending entirely on which frame is behind
// it. The shadow is what makes it legible over a bright still — opacity alone
// cannot be tuned for an image nobody chose.
//
// Fixed width so the captions line up under their circles, and never wrapped:
// six actions share ONE row on a 360px phone (318px against 320), so the width
// is what sets the row's width, and a caption that broke across two lines
// ("Add to" / "list") read as a mistake rather than a label. The phone labels
// are therefore ONE word each — the full phrase is still there from `sm` up,
// in the tooltip. `whitespace-nowrap` is the belt to that braces: a label that
// is somehow longer than its box overflows into its neighbour instead of
// breaking in half.
//
// aria-hidden, because every action already carries an aria-label and the
// caption would be read as a second, stray line of text.
const captionBase =
  'w-12 text-center text-[10px] leading-tight font-medium whitespace-nowrap text-white/90 [text-shadow:0_1px_3px_rgba(0,0,0,0.85)]'
// For the actions that print their own label from `sm` up (Trailer).
const phoneCaption = cn(captionBase, 'sm:hidden')
// For the circles: a caption on a phone, a tooltip from `sm`.
const tooltipCaption = cn(
  captionBase,
  'sm:pointer-events-none sm:absolute sm:top-full sm:z-10 sm:mt-2 sm:w-max sm:rounded-md sm:bg-black/85 sm:px-2 sm:py-1 sm:text-xs sm:opacity-0 sm:transition-opacity sm:duration-150 sm:text-shadow-none sm:group-focus-within/act:opacity-100 sm:group-hover/act:opacity-100'
)

const HeroAction = ({
  caption,
  phoneLabel,
  tooltip = true,
  children,
  magnetic = false,
}: {
  caption: string
  /**
   * The one-word label for a phone, where the caption has to fit inside a
   * 48px box without breaking. From `sm` up the tooltip carries the full
   * `caption` instead.
   */
  phoneLabel?: string
  /** False for an action that shows its own label from `sm` up. */
  tooltip?: boolean
  children: React.ReactNode
  /** Gently pulls the action toward the cursor on hover-capable devices. */
  magnetic?: boolean
}) => {
  const ref = useRef<HTMLDivElement>(null)
  const hasHover = useHasHoverPointer()
  useMagnetic(ref, 8, magnetic && hasHover)

  return (
    <div
      ref={ref}
      className="group/act relative flex flex-col items-center gap-1.5"
    >
      {children}
      {phoneLabel ? (
        <>
          <span aria-hidden className={cn(captionBase, 'sm:hidden')}>
            {phoneLabel}
          </span>
          {tooltip ? (
            <span aria-hidden className={cn(tooltipCaption, 'hidden sm:block')}>
              {caption}
            </span>
          ) : null}
        </>
      ) : (
        <span aria-hidden className={tooltip ? tooltipCaption : phoneCaption}>
          {caption}
        </span>
      )}
    </div>
  )
}

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
  logoPath,
  playTarget,
  isResume,
  isNext,
  resumeSlot,
  sourceControl,
  selfHost,
  onEnded,
  onFinished,
  blocked = false,
}: {
  movie?: MovieDetails
  series?: SeriesDetails
  /** Embed URL. Empty/undefined until the visitor presses play. */
  src?: string
  playVideo: () => void
  /**
   * Playback disabled for this title following a copyright notice — see
   * config/blocked-titles.json. The callers also withhold `src` and
   * `selfHost`, so there is nothing to play either way; this is what replaces
   * the control, so the page says so instead of offering a button that does
   * nothing. Everything else on the page — synopsis, cast, artwork, ratings,
   * and the official trailer — is unaffected.
   */
  blocked?: boolean
  trailerKey?: string
  /**
   * The title's official wordmark (lib/logos.ts), shown in place of the plain
   * title exactly as the homepage hero shows it. Null when TMDB has none.
   */
  logoPath?: string | null
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
  /** The resumed episode was finished; the target is the one after it. */
  isNext?: boolean
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
  /**
   * The Reely Player reached the end of what it was playing. Series pages use
   * it to start the next episode; a movie page passes nothing.
   */
  onEnded?: () => void
  /**
   * What is playing has been watched: it ended, or got past the credits
   * threshold, on the house player or an embed that reports progress. Both
   * pages tick it off, which is what moves "continue" past it.
   */
  onFinished?: () => void
}) => {
  const media = (movie || series) as MovieDetails & SeriesDetails
  const title = getMediaTitle(media)
  const isMovie = !!movie
  const isIframeShown = !!src

  // The wordmark is in the server HTML and normally decodes before anyone
  // could read the text it replaces. If it is slow, the plain title covers for
  // it after this; if it fails, the text is up at once (lib/hero-title.ts).
  const [titleGrace, setTitleGrace] = React.useState(false)
  React.useEffect(() => {
    const timer = setTimeout(() => setTitleGrace(true), 1500)
    return () => clearTimeout(timer)
  }, [])

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
  // A blocked title mints nothing: selfHost is already undefined so warmTicket
  // is a no-op, but not attaching the handler at all means the block does not
  // quietly depend on that staying true two refactors from now.
  const stackIntent = blocked ? undefined : playIntent

  // If the house player cannot start — ticket refused once PRO_PLAYER_OPEN is
  // lifted, or the worker not configured — fall back to the first embed and
  // let the switcher reflect it, exactly like a stalled server would.
  const onReelyUnavailable = React.useCallback(() => {
    if (!sourceControl) return
    // A free trial cannot "select" its way off - an anonymous visitor has no
    // switching at all - so leaving the trial is its own exit, back to the
    // server they had before.
    if (sourceControl.trial.status === 'active') {
      sourceControl.trial.end()
      return
    }
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

  // Bumped when the settings panel changes something the player only reads at
  // boot (the subtitle track above all). It is part of the frame's key, so the
  // player is remounted: a fresh ticket, and it comes back at the position it
  // has been storing all along. Nothing else remounts it, so a prefs refresh
  // arriving mid-title cannot interrupt anybody who did not ask for it.
  const [playerBoot, setPlayerBoot] = React.useState(0)
  const reloadPlayer = React.useCallback(() => {
    setLoadedSrc(null)
    setPlayerBoot((n) => n + 1)
  }, [])

  // Watch Together rides along when the URL carries the room (?watch=CODE).
  // Read after mount, not useSearchParams: this hero prerenders ~1000 times at
  // build, and a searchParams read at render would deopt every one of them.
  // The mount gate is load-bearing — the bar mounts before any play click, so
  // reading `window` during the first render hydrated a bar the server HTML
  // never had (React #418 on every invite link).
  // `remote=1` (from the host's QR) mounts the phone pad instead of the bar.
  const mounted = useMounted()
  const together = React.useMemo(() => {
    if (!mounted) return null
    const params = new URLSearchParams(window.location.search)
    const code = params.get('watch')
    const remoteKey = params.get(REMOTE_KEY_PARAM)
    return code
      ? {
          code,
          isHost: params.get('host') === '1',
          // A pad without the key could only fail at every press: a remote
          // link missing it opens as a plain guest instead.
          remoteKey: params.get('remote') === '1' ? remoteKey : null,
        }
      : null
  }, [mounted])

  // The reely surface reports readiness with its own pseudo-src so the stall
  // detector and the spinner treat both surfaces identically.
  const key = `${selfHost?.type ?? ''}:${selfHost?.id ?? ''}:${selfHost?.season ?? ''}:${selfHost?.episode ?? ''}`
  const reelyLoaded = useReely && loadedSrc === `reely:${key}`
  const shownLoaded = useReely ? reelyLoaded : iframeLoaded

  // One control bar, handed to whichever surface is mounted.
  //
  // Rendered over the house player too, not only over the embeds: the player is
  // a source like any other, and hiding the bar there left supporters — the
  // only people who ever see it — with no way to leave it from the page they
  // are on. Settings was the only exit, and Settings did not work either.
  //
  // It lives in the band ABOVE the picture rather than over it. Two things
  // already live along the bottom edge (the embed's own scrubber, and the
  // install prompt, which measurably sat on these buttons and swallowed the
  // click), and the top edge is where the sticky header used to eat it. The
  // band is reserved by PlayerStage, so "above the frame" is now a fact about
  // the layout instead of an assumption about two matching offsets.
  const controls = sourceControl ? (
    <SourceSwitcher
      control={sourceControl}
      loaded={shownLoaded}
      // Only while the house player is the one on screen. Every lever in there
      // — subtitles, their size, the mini bar, the jump to the next episode —
      // is read by the Reely Player and by nothing else, so over an embed it
      // would be a panel of controls that quietly do nothing.
      trailing={
        useReely ? (
          <PlayerSettings isSeries={!isMovie} onNeedsReload={reloadPlayer} />
        ) : undefined
      }
    />
  ) : null

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
    <>
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
                  // No entrance: the copy is in the server HTML where it belongs,
                  // and the page's <h1> lives in it. It used to rise in from
                  // opacity 0 once React hydrated, which hid the heading from the
                  // HTML and moved the play button while a thumb was on its way.
                  initial={false}
                  exit={{ opacity: 0, x: -150 }}
                  // absolute, NOT in flow — this is the layout shift on "Watch".
                  // The copy and the player are siblings in one flex box, so for
                  // the ~300ms the exit animation was still running BOTH were
                  // laid out: the iframe was sized next to a stack that was on
                  // its way out, then snapped to full width the frame it
                  // unmounted. Out of flow, the iframe gets the whole box from
                  // the moment it appears and the exit animates over the top.
                  //
                  // The padding is the container's own gutter (the container
                  // utility in styles/globals.css): absolute inset-0 spans its
                  // padding box, so without it the copy would not line up with
                  // the sections below.
                  //
                  // Bottom-anchored, left-aligned: the homepage hero's editorial
                  // column, so a title reads the same on both pages. pt-20 keeps
                  // the top of the column under the fixed header on a short phone.
                  // The bottom padding is NOT spacing: the install prompt and the
                  // tip-jar button are fixed to the bottom of the viewport, and
                  // measured in the first screenshot round they sat on this row's
                  // buttons (a prompt over a button swallows the tap — see the
                  // player-open rule beside it). 112px clears the prompt on a
                  // phone; from lg it is 96px, clear of the tip jar at the left.
                  className="absolute inset-0 flex flex-col justify-end px-5 pt-20 pb-28 sm:px-8 lg:pb-24"
                  // On the stack, not the button: a touch anywhere in it bubbles
                  // up here, and every control in it leads to the same player.
                  {...stackIntent}
                >
                  <div className="flex w-full max-w-3xl flex-col items-start">
                    {/* Reserved whether or not a chip lands in it: both are
                      decided after mount (they read the clock), and without the
                      row the title would drop a line a beat after paint. */}
                    <div className="mb-3 flex min-h-7 flex-wrap items-center gap-2">
                      <NewBadgeWhenRecent
                        date={media?.release_date || media?.first_air_date}
                        className="static"
                      />
                      {series && (
                        <AiringChip
                          episode={upcomingEpisode(series)}
                          className="static"
                        />
                      )}
                    </div>
                    <HeroWordmark
                      as="h1"
                      title={title ?? ''}
                      logoPath={logoPath}
                      extrasReady
                      graceElapsed={titleGrace}
                      loading="eager"
                      // The title, in the first screen: it must not queue at
                      // default priority behind the page's other images, or
                      // the name visibly arrives after everything around it.
                      fetchPriority="high"
                    />
                    {media?.tagline && (
                      <p className="mt-2 text-base text-white/85 italic drop-shadow-sm sm:text-lg [@media(max-height:640px)]:hidden">
                        {media.tagline}
                      </p>
                    )}
                    <HeroRatesInfos
                      movieDetails={movie}
                      seriesDetails={series}
                    />
                    {/* The four scores, in the hero, where the eye lands first - and
                      labelled, because a bare star does not say which source a
                      number came from. The full strip (with the vote counts) sits
                      below the fold. */}
                    <RatingsPills
                      tiles={media.ratings ?? []}
                      className="mt-2"
                    />
                    {/* The whole synopsis is in the section below; this is the
                      homepage's clamp, stepping down a whole line on a short
                      viewport rather than slicing one in half. */}
                    <p className="line-clamp-2 max-w-2xl text-sm leading-relaxed text-white/85 drop-shadow-sm sm:line-clamp-3 lg:text-lg [@media(max-height:640px)]:line-clamp-1">
                      {media?.overview}
                    </p>
                    {resumeSlot ? (
                      <div className="mt-4 w-full empty:hidden">
                        {resumeSlot}
                      </div>
                    ) : null}
                    <div className="mt-5 flex w-full flex-wrap items-start justify-between gap-x-1.5 gap-y-4 sm:mt-6 sm:items-center sm:justify-start sm:gap-3">
                      {blocked ? (
                        <div
                          role="status"
                          className="w-full max-w-md rounded-lg bg-black/70 px-5 py-4 ring-1 ring-white/15"
                        >
                          <p className="text-sm font-medium text-white">
                            Playback unavailable for this title
                          </p>
                          <p className="mt-1 text-xs leading-relaxed text-white/70">
                            We disabled it after a copyright notice from the
                            rights holder. Everything else on this page still
                            works.
                          </p>
                        </div>
                      ) : (
                        <PlayButton
                          onClick={playVideo}
                          media={media}
                          target={playTarget}
                          isResume={isResume}
                          isNext={isNext}
                          // A full-width thumb target on a phone, where it is the
                          // one thing most people came to press.
                          className="w-full sm:w-auto"
                        />
                      )}
                      {/* gap-x-1.5 + w-12 captions below sm: six actions (a title
                        with a trailer) share ONE row on a 360px phone — 318px
                        against 320. */}
                      {trailerKey && (
                        <HeroAction
                          caption="Play trailer"
                          phoneLabel="Trailer"
                          tooltip={false}
                          magnetic
                        >
                          <TrailerDialog
                            trailerKey={trailerKey}
                            mediaId={media?.id}
                            mediaType={isMovie ? 'movie' : 'tv'}
                            title={title}
                          />
                        </HeroAction>
                      )}
                      {/* The way to the season picker, which sits directly under
                        this hero. A plain in-page link: it works before
                        hydration, and the section's scroll margin clears the
                        fixed header. */}
                      {series && (
                        <HeroAction caption="Episodes" phoneLabel="Episodes">
                          <a
                            href="#episodes"
                            aria-label="Episodes"
                            className={cn(
                              buttonVariants({ variant: 'ghost', size: 'lg' }),
                              heroActionButtonBase,
                              heroActionButtonIdle,
                              heroActionIconOnly
                            )}
                          >
                            <ListVideo
                              className="size-5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]"
                              aria-hidden
                            />
                          </a>
                        </HeroAction>
                      )}
                      <HeroAction
                        caption="Save to watchlist"
                        phoneLabel="Save"
                        magnetic
                      >
                        <SaveButton
                          media={media}
                          className={heroActionIconOnly}
                        />
                      </HeroAction>
                      <HeroAction caption="Rate it" phoneLabel="Rate" magnetic>
                        <RateButton
                          media={media}
                          className={heroActionIconOnly}
                        />
                      </HeroAction>
                      {/* Whole-series "watched" is ambiguous (many episodes), so
                        the movie-level toggle only shows for movies; series
                        completion is tracked per-episode in the episode list. */}
                      {isMovie && movie && (
                        <HeroAction
                          caption="Watched"
                          phoneLabel="Watched"
                          magnetic
                        >
                          <WatchedButton
                            movie={movie}
                            className={heroActionIconOnly}
                          />
                        </HeroAction>
                      )}
                      <HeroAction caption="Share" phoneLabel="Share" magnetic>
                        <ShareButton
                          title={title}
                          mediaId={media?.id}
                          mediaType={isMovie ? 'movie' : 'tv'}
                          className={heroActionIconOnly}
                        />
                      </HeroAction>
                      {/* Second share action: the spoiler-free picture, next to
                        the link share it mirrors. */}
                      <HeroAction
                        caption="Share card"
                        phoneLabel="Card"
                        magnetic
                      >
                        <ShareCardButton
                          media={media}
                          className={heroActionIconOnly}
                        />
                      </HeroAction>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {/* The copy above leaves with the play, and the page's <h1> with it.
              The heading stays for anyone navigating by headings while the
              player is up. */}
            {isIframeShown ? <h1 className="sr-only">{title}</h1> : null}
            {useReely && selfHost ? (
              <PlayerStage
                loaded={reelyLoaded}
                controls={controls}
                bannerInset={!!together}
              >
                <ReelyPlayer
                  key={`${key}:${playerBoot}`}
                  target={selfHost}
                  onReady={() => setLoadedSrc(`reely:${key}`)}
                  onUnavailable={onReelyUnavailable}
                  onEnded={onEnded}
                  onFinished={onFinished}
                  frameRef={reelyFrameRef}
                />
              </PlayerStage>
            ) : (
              <PlayerStage
                loaded={iframeLoaded}
                // Not merely "do not draw the spinner": an inactive stage is
                // display:none, because it is size-full and paints over the
                // button stack it is a sibling of.
                active={isIframeShown}
                controls={controls}
                bannerInset={!!together}
              >
                <iframe
                  ref={iframeRef}
                  className="size-full"
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
                    onFinished={onFinished}
                  />
                )}
              </PlayerStage>
            )}
            {/* Mounted whether or not the player is open: the room is what the
              URL says, and a host who has not pressed play yet still needs the
              invite to send. Before play the guest loop has no frame to steer
              and simply idles. `remote=1` swaps the bar for the phone pad —
              the two never coexist: one device drives, one device follows. */}
            {together && together.remoteKey ? (
              <TogetherRemote
                code={together.code}
                remoteKey={together.remoteKey}
              />
            ) : null}
            {together && !together.remoteKey ? (
              <WatchTogetherBar
                code={together.code}
                isHost={together.isHost}
                frameRef={useReely ? reelyFrameRef : iframeRef}
              />
            ) : null}
          </div>
        </div>
        {/* Bottom-up, as on the homepage hero, so the copy column holds over any
          artwork; it runs out into the page background, so the hero melts into
          the sections below instead of ending on a hard edge. From lg a
          left-to-right layer adds weight behind the column. While something
          plays, both give way to an even dim and the picture is the brightest
          thing on screen. */}
        <div
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-0 bg-linear-to-t from-background via-background/55 via-40% to-black/30 transition-opacity duration-500 motion-reduce:transition-none',
            isIframeShown && 'opacity-0'
          )}
        />
        <div
          aria-hidden
          className={cn(
            // Masked out toward the bottom: it darkened the left half of the
            // hero's last row past the page colour, which drew a hard line
            // against the seam below. Static mask, nothing per frame.
            'pointer-events-none absolute inset-0 hidden bg-linear-to-r from-black/60 via-black/15 via-45% to-transparent mask-[linear-gradient(to_bottom,#000_70%,transparent)] transition-opacity duration-500 motion-reduce:transition-none lg:block',
            isIframeShown && 'opacity-0'
          )}
        />
        <div
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-0 bg-black/70 opacity-0 transition-opacity duration-500 motion-reduce:transition-none',
            isIframeShown && 'opacity-100'
          )}
        />
      </section>
      {/* Blends the hero into the page below (styles/globals.css). */}
      <div aria-hidden className="hero-seam" />
    </>
  )
}
