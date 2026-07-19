'use client'

import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useReducedMotion } from 'framer-motion'
import { Video, VideoOff, Volume2, VolumeX } from 'lucide-react'

import { MovieDetails } from '@/types/movie-details'
import { MovieGenre } from '@/types/movie-genre'
import { ItemType, Movie } from '@/types/movie-result'
import { SeriesDetails } from '@/types/series-details'
import { trackHeroAutoplayToggled, trackHeroWatchClicked } from '@/lib/analytics'
import { getImageURL, getPosterImageURL } from '@/lib/utils'
import { useHeroAutoplay } from '@/hooks/use-hero-autoplay'
import { useHeroExtras } from '@/hooks/use-hero-extras'
import { buttonVariants } from '@/components/ui/button'
import { CarouselPauseContext } from '@/components/carousel'
import { BlurredImage } from '@/components/blurred-image'
import { HeroRatesInfos } from '@/components/header/hero-rates-info'
import { HeroTrailerPreview } from '@/components/header/hero-trailer-preview'
import { Icons } from '@/components/icons'
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

export function HeroSlide({
  movie,
  genreTable,
  priority = false,
  active = false,
}: HeroSlideProps) {
  const media = movie as HeroSlideMedia
  const title = movie.title || movie.name || 'Untitled'
  const mediaType: ItemType =
    movie.media_type ?? (movie.first_air_date ? 'tv' : 'movie')

  const { trailerKey, logoPath } = useHeroExtras(movie.id, mediaType)

  const router = useRouter()
  const reduce = useReducedMotion()
  const [logoError, setLogoError] = React.useState(false)

  // Real pointers (desktop) preview on hover; touch devices have no hover, so
  // they autoplay the active slide's preview instead (effect below). Read once
  // at init; not rendered, so the SSR(false)/client(true) split is harmless.
  const [hasHover] = React.useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(hover: hover) and (pointer: fine)').matches
  )
  const [hovering, setHovering] = React.useState(false)
  const [previewActive, setPreviewActive] = React.useState(false)
  const [dialogOpen, setDialogOpen] = React.useState(false)

  // Mute state lives here (not in the trailer preview) so its toggle button can
  // render at the top-level z layer alongside the autoplay toggle. Nested in the
  // preview's `z-[5]` cover it sat beneath the scrims (z-10) and content (z-50)
  // and was effectively invisible/unclickable. Reset to muted whenever the
  // preview closes so audio never lingers into the next open.
  const [trailerMuted, setTrailerMuted] = React.useState(true)
  // Reset to muted when a preview session ends. Done by adjusting state during
  // render (tracking the previous value) rather than in an effect, so it never
  // triggers a cascading setState-in-effect. Reopening the same slide's preview
  // always starts muted — audio never lingers across opens.
  const [prevPreviewActive, setPrevPreviewActive] = React.useState(previewActive)
  if (previewActive !== prevPreviewActive) {
    setPrevPreviewActive(previewActive)
    if (!previewActive) setTrailerMuted(true)
  }

  // Touch-device autoplay is opt-out: on by default, persisted per user.
  const { enabled: autoplayEnabled, toggle: toggleAutoplay } = useHeroAutoplay()

  // Freeze carousel autoplay while a trailer is engaged (hover preview loading/
  // playing, or the trailer dialog open) so rotation never interrupts it. Keyed
  // by slide id — idempotent, so it can't leave autoplay stuck paused.
  const { setSlidePaused } = React.useContext(CarouselPauseContext)
  const trailerEngaged = previewActive || dialogOpen
  React.useEffect(() => {
    setSlidePaused(movie.id, trailerEngaged)
    return () => setSlidePaused(movie.id, false)
  }, [movie.id, trailerEngaged, setSlidePaused])

  // Arm the preview whenever the pointer is over the slide AND a trailer key is
  // available. Keying the timer off both means a key that arrives *after* the
  // hover started still triggers (the earlier bug: hovering before the lazy
  // fetch resolved showed nothing and never retried).
  React.useEffect(() => {
    if (!hovering || !hasHover || reduce || !trailerKey) return
    const t = setTimeout(() => setPreviewActive(true), HOVER_PREVIEW_DELAY)
    return () => clearTimeout(t)
  }, [hovering, hasHover, reduce, trailerKey])

  // Touch devices: autoplay the muted trailer once this slide is the on-screen
  // one — the mobile counterpart to the desktop hover preview. `trailerEngaged`
  // (above) freezes autoplay while it plays so the carousel doesn't rotate away
  // mid-trailer; a swipe still advances manually. Deactivating unmounts it.
  React.useEffect(() => {
    if (hasHover || reduce || !trailerKey || !active || !autoplayEnabled) return
    const t = setTimeout(() => setPreviewActive(true), TOUCH_PREVIEW_DELAY)
    return () => {
      clearTimeout(t)
      setPreviewActive(false)
    }
  }, [hasHover, reduce, trailerKey, active, autoplayEnabled])

  const href = mediaType === 'tv' ? `/tv-shows/${movie.id}` : `/movies/${movie.id}`

  const handleEnter = () => setHovering(true)
  const handleLeave = () => {
    setHovering(false)
    setPreviewActive(false)
  }

  const showLogo = !!logoPath && !logoError

  // "Cinematic takeover": while the trailer actually plays, the editorial copy
  // recedes and the text-scrim softens so the video owns the frame. Purely a
  // state-transition motion (trailer engaged → media mode). previewActive is
  // never true under reduced motion (both preview effects bail on `reduce`), so
  // this never animates there — the hero stays fully static.
  const cinematic = previewActive

  return (
    <div
      className="relative size-full overflow-hidden"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {/* Backdrop — full-bleed landscape, falling back to the poster. */}
      {media.backdrop_path ? (
        <BlurredImage
          src={getImageURL(media.backdrop_path)}
          alt={title}
          className="animate-hero-kenburns block size-full object-cover object-top will-change-transform motion-reduce:animate-none"
          fill
          sizes="(min-width: 1024px) 1024px, 100vw"
          intro
          priority={priority}
          loading={priority ? undefined : 'lazy'}
        />
      ) : (
        media.poster_path && (
          <BlurredImage
            src={getPosterImageURL(media.poster_path)}
            alt={title}
            className="animate-hero-kenburns block size-full object-cover object-center will-change-transform motion-reduce:animate-none"
            fill
            sizes="100vw"
            intro
            priority={priority}
            loading={priority ? undefined : 'lazy'}
          />
        )
      )}

      {/* Muted trailer that fades in on hover. */}
      {trailerKey && (
        <HeroTrailerPreview
          trailerKey={trailerKey}
          active={previewActive}
          title={title}
          muted={trailerMuted}
        />
      )}

      {/* Cinematic legibility scrims. Both soften during takeover so the playing
          trailer becomes the dominant layer; they retain just enough to keep the
          title and actions row (Watch Now) legible over the brighter video. */}
      <div
        className={`pointer-events-none absolute inset-0 z-10 bg-gradient-to-r from-black/90 via-black/55 to-black/20 transition-opacity duration-500 ease-out lg:to-transparent ${
          cinematic ? 'opacity-40' : 'opacity-100'
        }`}
      />
      <div
        className={`pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-black/80 via-black/10 to-black/30 transition-opacity duration-500 ease-out ${
          cinematic ? 'opacity-70' : 'opacity-100'
        }`}
      />

      <div className="absolute inset-0 z-50 pb-28 sm:pb-32 lg:pb-0">
        {/* Mobile: anchor copy to the lower third so the artwork breathes up top
            and the content can never overflow upward into the fixed header (the
            old vertical-centering pushed the NEW badge behind the header on tall
            slides). Desktop keeps the centered editorial layout. */}
        <div className="relative container flex h-full items-end justify-center gap-x-8 pt-24 lg:items-center lg:pt-28">
          <div className="flex w-full grow flex-col">
            {/* Title, badge and rating stay put during the takeover so the movie
                is always identifiable; only the long overview recedes (below) to
                give the trailer more of the frame. */}
            <div className="max-w-2xl">
              <NewBadgeWhenRecent
                date={movie.release_date || movie.first_air_date}
                className="relative top-0 left-0 mb-3 px-2.5 py-1 text-[11px] lg:text-xs"
              />
              {showLogo ? (
                <>
                  {/* Official title-logo treatment. Plain <img> so we don't
                      fight next/image over the logo's arbitrary aspect ratio;
                      falls back to the text title if it fails to load. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getImageURL(logoPath!)}
                    alt={title}
                    onError={() => setLogoError(true)}
                    className="mb-3 max-h-16 w-auto max-w-[80%] object-contain object-left drop-shadow-[0_2px_10px_rgba(0,0,0,0.65)] sm:max-h-20 lg:mb-4 lg:max-h-32"
                  />
                  <h2 className="sr-only">{title}</h2>
                </>
              ) : (
                <h2 className="text-3xl font-bold tracking-tight text-balance text-white drop-shadow-md sm:text-4xl lg:text-6xl">
                  {title}
                </h2>
              )}
              <HeroRatesInfos movie={movie} genreTable={genreTable} />
              <p
                className={`mt-2 line-clamp-2 max-w-xl text-sm leading-relaxed text-white/85 drop-shadow-sm transition-opacity duration-500 ease-out sm:line-clamp-3 lg:mt-3 lg:max-w-2xl lg:text-lg ${
                  cinematic ? 'opacity-65' : 'opacity-100'
                }`}
              >
                {movie.overview}
              </p>
            </div>

            {/* Actions: primary Watch + Trailer + Save. Left-aligned to match the
                copy column on every breakpoint. */}
            <div className="mt-5 flex flex-wrap items-center justify-start gap-2.5 sm:mt-6 sm:gap-3">
              <Link
                href={href}
                // Skip viewport auto-prefetch (the heavy watch route), but warm
                // it on hover/focus intent so the click navigates instantly.
                prefetch={false}
                onMouseEnter={() => router.prefetch(href)}
                onFocus={() => router.prefetch(href)}
                onClick={() =>
                  trackHeroWatchClicked({
                    media_id: movie.id,
                    media_type: mediaType,
                  })
                }
                className={buttonVariants({
                  variant: 'watchNow',
                  size: '2xl',
                  className: 'rounded-full',
                })}
              >
                <Icons.watch className="mr-2" />
                Watch Now
              </Link>

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
            <div className="relative min-h-[700px] w-[400px]">
              <BlurredImage
                src={getPosterImageURL(movie.poster_path)}
                alt={title}
                className="pointer-events-none size-full rounded-xl object-fill shadow-2xl ring-1 ring-white/10 lg:object-cover"
                fill
                sizes="(min-width: 1024px) 1024px, 30vw"
                intro
                priority={priority}
                loading={priority ? undefined : 'lazy'}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Mute toggle — top-level (not nested in the preview's z-[5] cover) so it
          clears the scrims/content and stays visible + clickable. Only while the
          trailer is actually playing. Mobile: sits left of the autoplay toggle
          (right-4) so they don't overlap; desktop has no autoplay toggle, so it
          takes the corner. */}
      {trailerKey && !reduce && previewActive && (
        <button
          type="button"
          onClick={() => setTrailerMuted((m) => !m)}
          aria-label={trailerMuted ? 'Unmute trailer' : 'Mute trailer'}
          aria-pressed={!trailerMuted}
          className="pointer-events-auto absolute right-[4.25rem] bottom-24 z-[60] flex size-10 items-center justify-center rounded-full border border-white/25 bg-black/40 text-white backdrop-blur-md transition hover:bg-black/60 lg:right-4 lg:bottom-16"
        >
          {trailerMuted ? (
            <VolumeX className="size-5" />
          ) : (
            <Volume2 className="size-5" />
          )}
        </button>
      )}

      {/* Autoplay opt-out (touch only — desktop previews on hover). Lets the user
          turn the muted trailer autoplay off/on; the choice persists. */}
      {trailerKey && !reduce && (
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
          className="pointer-events-auto absolute right-4 bottom-24 z-[60] flex size-10 items-center justify-center rounded-full border border-white/25 bg-black/40 text-white backdrop-blur-md transition hover:bg-black/60 lg:hidden"
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
