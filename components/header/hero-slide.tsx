'use client'

import React from 'react'
import { useReducedMotion } from 'framer-motion'
import { Maximize, Video, VideoOff, Volume2, VolumeX } from 'lucide-react'

import { MovieDetails } from '@/types/movie-details'
import { MovieGenre } from '@/types/movie-genre'
import { ItemType, Movie } from '@/types/movie-result'
import { SeriesDetails } from '@/types/series-details'
import {
  trackHeroAutoplayToggled,
  trackHeroWatchClicked,
} from '@/lib/analytics'
import { onIdleAfterLoad } from '@/lib/idle'
import { COVER_BACKDROP_SIZES, COVER_POSTER_SIZES } from '@/lib/image-sizes'
import { mediaDetailHref, resolveMediaType } from '@/lib/media'
import {
  cn,
  getImageURL,
  getLogoImageSrcSet,
  getLogoImageURL,
} from '@/lib/utils'
import { useHasHoverPointer, useLowPowerDevice } from '@/hooks/use-device-tier'
import { useHeroAutoplay } from '@/hooks/use-hero-autoplay'
import { useHeroExtras } from '@/hooks/use-hero-extras'
import { buttonVariants } from '@/components/ui/button'
import { BlurredImage } from '@/components/blurred-image'
import { CarouselPauseContext } from '@/components/carousel'
import { HeroRatesInfos } from '@/components/header/hero-rates-info'
import { HeroTrailerPreview } from '@/components/header/hero-trailer-preview'
import { Icons } from '@/components/icons'
import { MediaLink } from '@/components/media/media-link'
import { NewBadgeWhenRecent } from '@/components/new-badge-when-recent'
import { SaveButton } from '@/components/save-button'
import { TrailerDialog } from '@/components/trailer-dialog'

export type HeroSlideMedia = (Movie | MovieDetails) & SeriesDetails

interface HeroSlideProps {
  movie: Movie
  genreTable?: MovieGenre[]
  priority?: boolean
  /** True when this slide is the one on screen — injected by the Carousel.
      Drives the touch-device autoplay preview (no hover to key off). */
  active?: boolean
}

const HOVER_PREVIEW_DELAY = 500
const TOUCH_PREVIEW_DELAY = 1200

// Ken Burns runs on the slide you can SEE, and nowhere else.
//
// The carousel keeps a slide either side mounted so their artwork is decoded
// before they scroll in, but those two are parked a full stage-width away and
// clipped. Animating them was three full-viewport backdrops scaling forever
// instead of one, and `will-change: transform` pinned all three as compositor
// layers permanently — the animation is `both`, so the layer never demoted even
// after the 14s finished. On a throttled phone that was the whole problem:
// a swipe then had to composite three oversized promoted textures while the
// track sprang. Measured 94.7ms/frame average, 351ms worst.
//
// Off-slides get no animation and no promotion; they are invisible, so there is
// nothing to lose. The class swap restarts the animation as a slide becomes
// active, which is the correct behaviour anyway — the pan should begin when the
// slide takes the frame, not partway through.
//
// And on a weak device, nowhere at all. Even one instance is a full-viewport
// backdrop being scaled for 14s straight — continuous compositor work for as
// long as the slide is up, which is most of the time. See
// hooks/use-device-tier.ts for what counts as weak.
const kenBurns = (active: boolean, lowPower: boolean) =>
  active && !lowPower
    ? 'animate-hero-kenburns will-change-transform motion-reduce:animate-none'
    : ''

// Whether the hero has resolved its title treatment once for this page load.
// Module-scoped on purpose: it must survive a slide unmounting, which is exactly
// what the windowed carousel does every time you swipe. See titleGraceElapsed.
let firstPaintSettled = false

export function HeroSlide({
  movie,
  genreTable,
  priority = false,
  active = false,
}: HeroSlideProps) {
  const media = movie as HeroSlideMedia
  const title = movie.title || movie.name || 'Untitled'
  const mediaType: ItemType = resolveMediaType(movie)

  const {
    trailerKey,
    logoPath,
    ready: extrasReady,
  } = useHeroExtras(movie.id, mediaType)

  const reduce = useReducedMotion()
  const [logoError, setLogoError] = React.useState(false)
  // Gates the title-logo crossfade: the text title holds the frame until the
  // logo image has actually decoded, then they crossfade — no hard text→logo pop.
  const [logoLoaded, setLogoLoaded] = React.useState(false)

  const markLogoLoaded = React.useCallback(() => {
    firstPaintSettled = true
    setLogoLoaded(true)
  }, [])
  const markLogoError = React.useCallback(() => {
    firstPaintSettled = true
    setLogoError(true)
  }, [])
  // onLoad alone is NOT enough for a server-rendered <img>. The logo ships in the
  // SSR HTML, so on a warm cache the browser decodes it before React hydrates and
  // attaches the listener — the event has already fired, nothing is listening,
  // and logoLoaded stays false forever. The logo then sits at opacity-0 while the
  // text title stays held, which is why the hero showed the plain title (or, on a
  // remounted slide, no title at all). A ref callback runs at attach time and can
  // read img.complete, catching exactly the case the event misses. naturalWidth
  // distinguishes a decoded image from a completed-but-broken one.
  const logoRef = React.useCallback(
    (node: HTMLImageElement | null) => {
      if (!node?.complete) return
      if (node.naturalWidth > 0) markLogoLoaded()
      else markLogoError()
    },
    [markLogoLoaded, markLogoError]
  )
  // First (uncached) paint: hold the fallback-font text back until we know the
  // logo's fate — resolves to no-logo, or the logo decodes and crossfades in —
  // so the styled logo is never pre-empted by a flash of the plain title. A
  // grace cap still reveals the text if the logo is genuinely slow, so the title
  // never stays hidden. Refresh is a cache hit: extras are ready synchronously
  // and the logo decodes fast, so the text never shows at all.
  // The grace only ever applied to the page's FIRST paint. Slides are windowed,
  // so swiping unmounts and re-mounts them — each remount restarted a fresh
  // 2.2s timer and the slide landed with NO title at all, which is the blank
  // hero. After the first slide has resolved once, a brief flash of the plain
  // title is strictly better than 2.2s of nothing, so skip the hold entirely.
  const [titleGraceElapsed, setTitleGraceElapsed] = React.useState(
    () => firstPaintSettled
  )
  React.useEffect(() => {
    if (firstPaintSettled) return
    const t = setTimeout(() => {
      firstPaintSettled = true
      setTitleGraceElapsed(true)
    }, 2200)
    return () => clearTimeout(t)
  }, [])

  // Desktop pointers get a slightly longer arm delay than touch (they can flick
  // across slides). Also decides whether ambient autoplay is on by DEFAULT —
  // see the note on useHeroAutoplay below.
  //
  // Reads the shared hydration-safe hook rather than matchMedia in a useState
  // initialiser. The local copy was fine while this value only picked a timeout,
  // but it now feeds rendered output (the autoplay toggle's pressed state), and
  // an initialiser runs during hydration where matchMedia is real — the exact
  // mismatch useHasHoverPointer exists to avoid.
  const hasHover = useHasHoverPointer()
  // Whether this device gets the optional ambient effects at all.
  const lowPower = useLowPowerDevice()
  const [previewActive, setPreviewActive] = React.useState(false)
  const [dialogOpen, setDialogOpen] = React.useState(false)

  // Mute state lives here (not in the trailer preview) so its toggle button can
  // render at the top-level z layer alongside the autoplay toggle. Nested in the
  // preview's `z-[5]` cover it sat beneath the scrims (z-10) and content (z-30)
  // and was effectively invisible/unclickable. Reset to muted whenever the
  // preview closes so audio never lingers into the next open.
  const [trailerMuted, setTrailerMuted] = React.useState(true)
  // Reset to muted when a preview session ends. Done by adjusting state during
  // render (tracking the previous value) rather than in an effect, so it never
  // triggers a cascading setState-in-effect. Reopening the same slide's preview
  // always starts muted — audio never lingers across opens.
  // Paused state for full view (custom play/pause + spacebar). Ambient preview
  // always plays; pause only exists inside full view.
  const [paused, setPaused] = React.useState(false)
  const [prevPreviewActive, setPrevPreviewActive] =
    React.useState(previewActive)
  if (previewActive !== prevPreviewActive) {
    setPrevPreviewActive(previewActive)
    if (!previewActive) {
      setTrailerMuted(true)
      setPaused(false)
    }
  }

  // Trailer autoplay is opt-out, persisted per user. Governs both the touch
  // active-slide autoplay AND the desktop hover/active preview, so the one
  // toggle fully turns trailer previews off everywhere.
  //
  // The device signals only pick the DEFAULT — they are not a second gate below
  // the toggle. That is the older bug: the tier gated playback directly, and
  // since practically every phone reads as low power, the toggle showed ON on
  // mobile while the trailer could never actually start.
  //
  // Ambient autoplay now defaults off on TOUCH, not just on weak devices. It
  // mounts a YouTube embed, and the player chain is ~6.9MB across 31 requests
  // (measured, mobile prod) — the largest single cost on the homepage by an
  // order of magnitude, spent on decoration for a phone that is probably on
  // cellular. `lowPower` didn't cover it: a flagship phone passes the cores and
  // memory checks and paid the full 6.9MB. Nothing is removed — the Trailer
  // button and full view work everywhere, and this toggle turns ambience on and
  // remembers it.
  const { enabled: autoplayEnabled, toggle: toggleAutoplay } = useHeroAutoplay(
    !lowPower && hasHover
  )

  // Full-view (native browser fullscreen) of the playing trailer. Ref points at
  // the trailer cover element; fullscreen it directly so the video owns the
  // screen. Entering unmutes for a focused watch; exiting LEAVES the sound on
  // (re-muting on exit felt broken). Driven off `fullscreenchange` so the state
  // stays in sync with Esc too.
  const trailerContainerRef = React.useRef<HTMLDivElement>(null)
  const [isFullscreen, setIsFullscreen] = React.useState(false)
  React.useEffect(() => {
    const onChange = () => {
      // Guard the null case: with no fullscreen element AND the cover unmounted
      // both sides are null, so a bare `===` would latch true. Require an actual
      // fullscreen element that IS our cover.
      const active =
        document.fullscreenElement != null &&
        document.fullscreenElement === trailerContainerRef.current
      setIsFullscreen(active)
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])
  // Leave fullscreen if the preview ends (e.g. autoplay turned off) while active.
  React.useEffect(() => {
    if (!previewActive && document.fullscreenElement)
      void document.exitFullscreen?.()
  }, [previewActive])
  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen?.()
    } else {
      // Focus mode starts playing + with sound. The gesture (this click) carries
      // into unMute so the browser allows audio; it stays unmuted after exiting.
      setPaused(false)
      setTrailerMuted(false)
      void trailerContainerRef.current?.requestFullscreen?.()
    }
  }

  // Spacebar toggles play/pause while in full view (matches the on-screen
  // button). Ignored outside fullscreen so it never hijacks the page's scroll.
  React.useEffect(() => {
    if (!isFullscreen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault()
        setPaused((p) => !p)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isFullscreen])

  // Freeze carousel autoplay while a trailer is engaged (hover preview loading/
  // playing, or the trailer dialog open) so rotation never interrupts it. Keyed
  // by slide id — idempotent, so it can't leave autoplay stuck paused.
  const { setSlidePaused } = React.useContext(CarouselPauseContext)
  const trailerEngaged = previewActive || dialogOpen
  React.useEffect(() => {
    setSlidePaused(movie.id, trailerEngaged)
    return () => setSlidePaused(movie.id, false)
  }, [movie.id, trailerEngaged, setSlidePaused])

  // Autoplay the muted trailer for the whole time this slide is the on-screen
  // one — same opt-out behaviour on every device. The preview is tied ONLY to
  // the slide being active (+ autoplay enabled + a key), never to hover, so the
  // trailer keeps playing when the pointer wanders off the stage or up to the
  // header. `trailerEngaged` freezes carousel rotation while it plays so it
  // never rotates away mid-trailer; a swipe still advances manually. When the
  // slide goes inactive the cleanup unmounts it.
  //
  // The arm is queued behind page load + an idle slot, not fired off a bare
  // timer from mount. Mounting the preview pulls in a YouTube embed — ~880KB of
  // third-party script, measured, by far the heaviest thing the homepage
  // touches — and the old 1.2s timer dropped that squarely into hydration, next
  // to the LCP backdrop still decoding. The trailer is ambience; it has no claim
  // on that slot. After first load the document is already `complete`, so a
  // slide the user swipes to arms on the same delay as before.
  React.useEffect(() => {
    if (reduce || !trailerKey || !active || !autoplayEnabled) return
    const cancel = onIdleAfterLoad(
      () => setPreviewActive(true),
      hasHover ? HOVER_PREVIEW_DELAY : TOUCH_PREVIEW_DELAY
    )
    return () => {
      cancel()
      setPreviewActive(false)
    }
  }, [hasHover, reduce, trailerKey, active, autoplayEnabled])

  const href = mediaDetailHref(mediaType, movie.id)

  const showLogo = !!logoPath && !logoError
  // Keep the plain title hidden while the logo's outcome is still pending
  // (extras in flight, or a known logo not yet decoded) — unless the grace cap
  // has passed, at which point the text is revealed as the fallback.
  const holdTitleText =
    !titleGraceElapsed && (!extrasReady || (showLogo && !logoLoaded))

  // "Cinematic takeover": while the trailer actually plays, the editorial copy
  // recedes and the text-scrim softens so the video owns the frame. Purely a
  // state-transition motion (trailer engaged → media mode). previewActive is
  // never true under reduced motion (both preview effects bail on `reduce`), so
  // this never animates there — the hero stays fully static.
  const cinematic = previewActive

  return (
    <div className="relative size-full overflow-hidden">
      {/* Backdrop — full-bleed landscape, falling back to the poster. */}
      {media.backdrop_path ? (
        <BlurredImage
          src={getImageURL(media.backdrop_path)}
          alt={title}
          className={`block size-full object-cover object-top ${kenBurns(active, lowPower)}`}
          fill
          // Full-bleed AND `object-cover`, which is why this is not `100vw`:
          // on any viewport taller than 16:9 the cover math paints the backdrop
          // far wider than the box, and `100vw` under-described it by 4x on a
          // phone (measured: 1200px of image stretched across 4498 device px).
          // See lib/image-sizes.ts — including why the phone case keeps a
          // deliberate brake instead of asking for the full cover width.
          sizes={COVER_BACKDROP_SIZES}
          intro
          // Not `priority`: same trade as the details hero (see
          // components/header/hero-image.tsx). Dropping Next's WebP preload is
          // what lets slide 0 take the AVIF <source> like every other slide —
          // measured on the details page at 110 KB -> 65 KB for the same 2560px
          // hero, and the fetch still starts from the document, which the
          // preload scanner reads before any of this hydrates.
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
        />
      ) : (
        media.poster_path && (
          <BlurredImage
            // `original`, not w500: with no backdrop this poster IS the hero,
            // cover-cropped across the whole viewport, so a 500px source was
            // the ceiling on a full-bleed image. The loader only ever requests
            // the width the layout asks for, so a bigger source costs nothing.
            src={getImageURL(media.poster_path)}
            alt={title}
            className={`block size-full object-cover object-center ${kenBurns(active, lowPower)}`}
            fill
            sizes={COVER_POSTER_SIZES}
            intro
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : 'auto'}
          />
        )
      )}

      {/* Muted trailer that fades in on hover. */}
      {trailerKey && (
        <HeroTrailerPreview
          ref={trailerContainerRef}
          trailerKey={trailerKey}
          active={previewActive}
          title={title}
          muted={trailerMuted}
          fullscreen={isFullscreen}
          touch={!hasHover}
          paused={paused}
          onExitFullscreen={toggleFullscreen}
          onTogglePlay={() => setPaused((p) => !p)}
          onToggleMute={() => setTrailerMuted((m) => !m)}
        />
      )}

      {/* Legibility scrim — vertical ONLY, and that is the whole point.

          There used to be a horizontal one too (from-black/90 ... to-black/20).
          It is what put a border down the middle of every swipe: a horizontal
          gradient makes a slide dark on one edge and bright on the other, so
          two of them side by side meet bright-against-dark. That step IS the
          border. It was fought three times — a 24px black gutter, fade overlays
          that switched on while the track moved, then sealing both edges to
          black — and each fix only changed the border's colour, because each
          one still varied the treatment across x.

          A gradient that runs bottom-to-top is constant along x. Every column of
          every slide is treated identically, so neighbouring slides meet at
          exactly matching luminance no matter where the artwork is bright or
          dark. There is no step to see, at any drag offset, with nothing to
          toggle and no gutter. It is also one full-screen gradient layer
          instead of three.

          The copy is bottom-anchored, so bottom-up is where the coverage was
          needed anyway; from-black/95 carries the title, chips, overview and
          buttons over bright artwork. Softens during the trailer takeover so the
          video owns the frame. */}
      <div
        className={`pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-black/95 via-black/55 to-black/25 transition-opacity duration-500 ease-out ${
          cinematic ? 'opacity-60' : 'opacity-100'
        }`}
      />

      {/* z-30, NOT z-50: above the scrims (z-10) and the trailer cover (z-20),
          but strictly BELOW the fixed site header (z-40). This copy block is
          bottom-anchored on mobile, so on a short viewport with a tall slide its
          top edge can rise into the header band — at z-50 it painted OVER the
          header and the NEW badge (the topmost element in the column) collided
          with the nav. Ranking it under the header makes that impossible no
          matter how tall the content gets. The takeover controls below keep
          their z-[60]+ on purpose: those must stay reachable over the header. */}
      {/* pb-24 on mobile (not pb-28): the dots sit at bottom-3 and the counter
          adds ~44px, so 96px clears them with room to spare — the extra 16px
          goes back to the copy, which is what was running out of height. */}
      <div className="absolute inset-0 z-30 pb-24 sm:pb-32 lg:pb-0">
        {/* Mobile: anchor copy to the lower third so the artwork breathes up top
            and the content can never overflow upward into the fixed header (the
            old vertical-centering pushed the NEW badge behind the header on tall
            slides). Desktop keeps the centered editorial layout.
            pt-20 = 64px header + 16px clearance; the old pt-24 spent 32px of
            clearance the short-viewport layout could not afford. */}
        {/* Mobile is a flex COLUMN with the copy pushed down by `mt-auto`, not
            `items-end`. Both bottom-anchor the copy, but they fail differently
            when the content is taller than the box: `items-end` overflows
            UPWARD (the badge and logo disappear behind the opaque header),
            while an auto top margin collapses to 0 and the overflow goes
            DOWNWARD into the 96px bottom padding that only holds the dots — so
            the copy stays fully readable. Desktop keeps the centered row. */}
        <div className="relative container flex h-full flex-col gap-x-8 pt-20 sm:pt-24 lg:flex-row lg:items-center lg:justify-center lg:pt-28">
          {/* No height cap here on purpose. Capping the column (max-h-full) and
              clipping the text block was what sliced the overview through the
              middle of a line on short viewports. The copy is sized to FIT
              instead — trimmed paddings above/below, a single-row actions row,
              and a line-clamp that steps down a whole line on very short
              viewports — so nothing is ever cut mid-glyph. The header is still
              safe regardless: this whole block is z-30, strictly below the
              header's z-40, so it can never paint over the nav. */}
          <div className="mt-auto flex w-full grow-0 flex-col lg:mt-0 lg:grow">
            {/* Title, badge and rating stay put during the takeover so the movie
                is always identifiable; only the long overview recedes (below) to
                give the trailer more of the frame. */}
            <div className="max-w-2xl">
              {/* The badge is its own row ABOVE the title, always. It used to
                  share a bottom-aligned column with the text title inside the
                  logo's reserved box — but the logo is absolutely positioned at
                  bottom-0 left-0, so once it decoded it painted straight through
                  the badge (or the badge, at z-10, painted over the wordmark).
                  Out here it can't collide with either treatment, and the badge
                  and title markup exist once instead of once per branch. */}
              {/* The row is reserved whether or not a badge lands in it: the
                  badge is decided after mount (it reads the clock, see
                  NewBadgeWhenRecent) and without the reservation every hero
                  nudged the title down a row a beat after paint — and every
                  carousel slide without a badge sat 32px higher than the one
                  before it. */}
              <div className="mb-3 flex min-h-8 flex-col items-start lg:mb-4">
                <NewBadgeWhenRecent
                  date={movie.release_date || movie.first_air_date}
                  className="relative top-0 left-0 mb-2 px-2.5 py-1 text-[11px] lg:text-xs"
                />
                {showLogo ? (
                  // Stack the text title and the official logo in one bottom-
                  // aligned box that reserves the logo's height, so there's no
                  // layout jump and no hard swap: the text shows immediately and
                  // holds the frame, then crossfades out as the decoded logo
                  // rises in. Plain <img> so we don't fight next/image over the
                  // logo's arbitrary aspect ratio; falls back to text on error.
                  <div className="relative flex min-h-16 w-full items-end sm:min-h-20 lg:min-h-32">
                    <h2
                      aria-hidden={logoLoaded}
                      className={`text-3xl font-bold tracking-tight text-balance text-white drop-shadow-md transition-opacity duration-500 ease-out sm:text-4xl lg:text-6xl ${
                        logoLoaded || holdTitleText
                          ? 'opacity-0'
                          : 'opacity-100'
                      }`}
                    >
                      {title}
                    </h2>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      ref={logoRef}
                      src={getLogoImageURL(logoPath!)}
                      // A plain <img> gets no srcset from next/image, so the
                      // density pair is written by hand: the wordmark lays out
                      // at ~500 CSS px, which retina paints at 1000.
                      srcSet={getLogoImageSrcSet(logoPath!)}
                      alt={title}
                      // The first slide's wordmark is part of the LCP frame and
                      // races a fallback timer; tell the browser so it isn't
                      // queued behind the rails' posters.
                      fetchPriority={priority ? 'high' : 'auto'}
                      // The carousel keeps a slide mounted either side, and
                      // their wordmarks are parked a stage-width away where
                      // nobody can see them. Eager, they were 3 logo downloads
                      // on load — measured at 24/59/67 KB once the 2x file
                      // exists, i.e. more than the hero backdrop itself. Lazy,
                      // an off-stage slide fetches its logo when it slides in,
                      // behind the title-text fallback the crossfade already
                      // has for exactly this case.
                      loading={priority ? 'eager' : 'lazy'}
                      // Same reason as every image in BlurredImage: a native
                      // image drag would ghost the logo and eat the gesture.
                      draggable={false}
                      onError={markLogoError}
                      onLoad={markLogoLoaded}
                      className={`absolute bottom-0 left-0 max-h-16 w-auto max-w-[80%] object-contain object-left drop-shadow-[0_2px_10px_rgba(0,0,0,0.65)] transition-all duration-700 ease-out sm:max-h-20 lg:max-h-32 ${
                        logoLoaded
                          ? 'blur-0 translate-y-0 opacity-100'
                          : 'pointer-events-none translate-y-2 opacity-0 blur-[2px]'
                      }`}
                    />
                  </div>
                ) : (
                  <h2
                    className={`text-3xl font-bold tracking-tight text-balance text-white drop-shadow-md transition-opacity duration-500 ease-out sm:text-4xl lg:text-6xl ${
                      holdTitleText ? 'opacity-0' : 'opacity-100'
                    }`}
                  >
                    {title}
                  </h2>
                )}
              </div>
              <HeroRatesInfos movie={movie} genreTable={genreTable} />
              {/* The clamp steps down by a WHOLE line on very short viewports
                  (~600px and under, e.g. a small phone with browser chrome)
                  rather than letting the block get sliced through a line box.
                  Clamped text always ends on an ellipsis, never a half-glyph. */}
              <p
                className={`mt-2 line-clamp-2 max-w-xl text-sm leading-relaxed text-white/85 drop-shadow-sm transition-opacity duration-500 ease-out sm:line-clamp-3 lg:mt-3 lg:max-w-2xl lg:text-lg [@media(max-height:600px)]:line-clamp-1 ${
                  cinematic ? 'opacity-65' : 'opacity-100'
                }`}
              >
                {movie.overview}
              </p>
            </div>

            {/* Actions: primary Watch + Trailer + Save. Left-aligned to match the
                copy column on every breakpoint. */}
            {/* gap-2 below sm: at 320px the three controls plus 2.5-gaps came to
                exactly the 280px content box and tipped Save onto its own row.
                8px gaps leave the row 4px of slack on the narrowest phone. */}
            <div className="mt-5 flex flex-wrap items-center justify-start gap-2 sm:mt-6 sm:gap-3">
              {/* Skips viewport auto-prefetch (the heavy watch route) and warms
                  on intent instead — see components/media/media-link.tsx. It
                  used to be a hand-rolled onMouseEnter/onFocus pair here, which
                  meant the hero's primary CTA warmed nothing at all on a phone:
                  the one device with no hover, and the one where the cold RSC
                  fetch hurts most. */}
              <MediaLink
                href={href}
                onClick={() =>
                  trackHeroWatchClicked({
                    media_id: movie.id,
                    media_type: mediaType,
                  })
                }
                // cn(), not buttonVariants' own `className` slot: cva only
                // concatenates, so the size's px-12 would still win over the
                // mobile override. twMerge actually replaces it.
                className={cn(
                  buttonVariants({ variant: 'watchNow', size: '2xl' }),
                  // Tighter pill below sm. At 367px wide the full-size pill made
                  // the row 345px against a 327px container, so Save wrapped to a
                  // second row and ate ~54px of vertical space the copy needed.
                  // Narrower = one row, everything on screen; full size from sm up.
                  'rounded-full px-5 text-lg sm:px-12 sm:text-xl'
                )}
              >
                <Icons.watch className="mr-2" />
                Watch Now
              </MediaLink>

              {trailerKey && (
                <TrailerDialog
                  trailerKey={trailerKey}
                  mediaId={movie.id}
                  mediaType={mediaType}
                  title={title}
                  onOpenChange={setDialogOpen}
                />
              )}

              {/* SaveButton only reads shared fields (id, title/name, overview,
                  artwork) via toWatchedItem; the trending Movie carries them all. */}
              <SaveButton
                media={media as unknown as MovieDetails & SeriesDetails}
              />
            </div>
          </div>

          <div
            className={`hidden transition-all duration-500 ease-out lg:flex ${
              cinematic ? 'opacity-0 blur-sm' : 'blur-0 opacity-100'
            }`}
          >
            <div className="relative min-h-[700px] w-[400px] overflow-hidden rounded-xl shadow-2xl">
              {/* `sizes` is a flat 400px because the box above is a flat 400px,
                  and this panel only exists at lg and up (the wrapper is
                  `hidden lg:flex`). The old value claimed 1024px there and 30vw
                  below it: the first asked for 2.5x the pixels the box can show,
                  and the second described a breakpoint at which this element is
                  display:none.

                  Never `priority`, even on the first slide. It used to inherit
                  it, which meant every phone and tablet load eagerly fetched
                  this poster AND emitted a <link rel=preload imagesrcset> for
                  it — for an element that is display:none at that width and can
                  never paint. `loading="lazy"` is what actually stops it: a
                  display:none image never intersects the viewport, so it is not
                  requested at all below lg, and above lg it is in view and
                  fetched immediately. It is decorative anyway — it enters from
                  opacity-0 behind a 500ms transition and is never the LCP, which
                  is the full-bleed backdrop. */}
              <BlurredImage
                // `original`, not w500. The box is 400 CSS px wide and 700 tall
                // with `object-cover`, so a dpr-2 laptop paints it at 800+
                // device px — measured needing 933 against a 500px source, i.e.
                // an upscale no `sizes` value could fix, because the source
                // itself was the ceiling. Only ever fetched above lg (see
                // below), where the extra width is exactly what is on screen.
                src={getImageURL(movie.poster_path)}
                alt={title}
                className="pointer-events-none size-full object-fill lg:object-cover"
                fill
                // 470, not the box's 400: the frame is 400x700 and a 2:3 poster
                // is cover-cropped into it, so the height binds and the poster
                // paints ~467 CSS px wide. Measured at dpr 2 it needs 933 and
                // `400px` was picking the 828 rung.
                sizes="470px"
                intro
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Control cluster — all top-level (not nested in the preview's z-[5]
          cover) so they clear the scrims/content and stay visible + clickable.
          Right → left: autoplay toggle (always, when a trailer exists), then
          mute + full-view (only while the trailer is actually playing). Fixed
          right offsets keep them from ever overlapping each other.
          Mobile parks the stack at top-20 (clear of the 64px header) instead of
          bottom-24: at the bottom it sat in the exact same band as the actions
          row and covered Trailer/Save on a narrow phone. Desktop has width to
          spare, so it keeps the bottom-right corner. */}

      {/* Full view (enter) — native browser fullscreen, "focus on the play".
          Only while the trailer plays; the EXIT control lives inside the cover
          (HeroTrailerPreview) since these page-level buttons vanish in
          fullscreen. */}
      {!reduce && previewActive && !isFullscreen && (
        <button
          type="button"
          onClick={toggleFullscreen}
          aria-label="Full view"
          className="pointer-events-auto absolute top-20 right-[7.5rem] z-[60] flex size-10 items-center justify-center rounded-full border border-white/25 bg-black/40 text-white backdrop-blur-md transition hover:bg-black/60 lg:top-auto lg:bottom-16"
        >
          <Maximize className="size-5" />
        </button>
      )}

      {/* Mute toggle — only while the trailer is actually playing. */}
      {!reduce && previewActive && !isFullscreen && (
        <button
          type="button"
          onClick={() => setTrailerMuted((m) => !m)}
          aria-label={trailerMuted ? 'Unmute trailer' : 'Mute trailer'}
          aria-pressed={!trailerMuted}
          className="pointer-events-auto absolute top-20 right-[4.25rem] z-[60] flex size-10 items-center justify-center rounded-full border border-white/25 bg-black/40 text-white backdrop-blur-md transition hover:bg-black/60 lg:top-auto lg:bottom-16"
        >
          {trailerMuted ? (
            <VolumeX className="size-5" />
          ) : (
            <Volume2 className="size-5" />
          )}
        </button>
      )}

      {/* Autoplay opt-out — every breakpoint (desktop autoplays too). Shown as
          soon as this slide is on screen (not gated on the lazy trailer fetch)
          so it doesn't pop in late; toggling persists the choice. Hidden in
          fullscreen. */}
      {!reduce && active && !isFullscreen && (
        <button
          type="button"
          onClick={() => {
            trackHeroAutoplayToggled({
              enabled: !autoplayEnabled,
              media_id: movie.id,
              media_type: mediaType,
            })
            toggleAutoplay()
          }}
          aria-label={
            autoplayEnabled
              ? 'Turn off trailer autoplay'
              : 'Turn on trailer autoplay'
          }
          aria-pressed={autoplayEnabled}
          className="pointer-events-auto absolute top-20 right-4 z-[60] flex size-10 items-center justify-center rounded-full border border-white/25 bg-black/40 text-white backdrop-blur-md transition hover:bg-black/60 lg:top-auto lg:bottom-16"
        >
          {autoplayEnabled ? (
            <Video className="size-5" />
          ) : (
            <VideoOff className="size-5" />
          )}
        </button>
      )}
    </div>
  )
}
