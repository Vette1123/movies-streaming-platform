'use client'

import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useReducedMotion } from 'framer-motion'

import { MovieDetails } from '@/types/movie-details'
import { MovieGenre } from '@/types/movie-genre'
import { ItemType, Movie } from '@/types/movie-result'
import { SeriesDetails } from '@/types/series-details'
import { trackHeroWatchClicked } from '@/lib/analytics'
import { getImageURL, getPosterImageURL } from '@/lib/utils'
import { useHeroExtras } from '@/hooks/use-hero-extras'
import { buttonVariants } from '@/components/ui/button'
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
}

const HOVER_PREVIEW_DELAY = 900

export function HeroSlide({ movie, genreTable, priority = false }: HeroSlideProps) {
  const media = movie as HeroSlideMedia
  const title = movie.title || movie.name || 'Untitled'
  const mediaType: ItemType =
    movie.media_type ?? (movie.first_air_date ? 'tv' : 'movie')

  const { trailerKey, logoPath } = useHeroExtras(movie.id, mediaType)

  const router = useRouter()
  const reduce = useReducedMotion()
  const [logoError, setLogoError] = React.useState(false)

  // Hover-to-preview only makes sense on a real pointer (no phantom taps on
  // touch, no autoplay video on reduced-motion setups). Read once at init;
  // canPreview isn't rendered, so the SSR(false)/client(true) split is harmless.
  const [canPreview] = React.useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(hover: hover) and (pointer: fine)').matches
  )
  const [previewActive, setPreviewActive] = React.useState(false)
  const hoverTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    return () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current)
    }
  }, [])

  const href = mediaType === 'tv' ? `/tv-shows/${movie.id}` : `/movies/${movie.id}`

  const handleEnter = () => {
    if (!canPreview || reduce || !trailerKey) return
    hoverTimer.current = setTimeout(() => setPreviewActive(true), HOVER_PREVIEW_DELAY)
  }
  const handleLeave = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    setPreviewActive(false)
  }

  const showLogo = !!logoPath && !logoError

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
        />
      )}

      {/* Cinematic legibility scrims. */}
      <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-r from-black/90 via-black/55 to-black/20 lg:to-transparent" />
      <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-black/80 via-black/10 to-black/30" />

      <div className="absolute inset-0 z-50 pb-36 lg:pb-0">
        <div className="relative container flex h-full items-center justify-center gap-x-8 pt-20 lg:pt-28">
          <div className="flex w-full grow flex-col">
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
                    className="mb-3 max-h-20 w-auto max-w-[85%] object-contain object-left drop-shadow-[0_2px_10px_rgba(0,0,0,0.65)] lg:mb-4 lg:max-h-32"
                  />
                  <h2 className="sr-only">{title}</h2>
                </>
              ) : (
                <h2 className="text-3xl font-bold tracking-tight whitespace-nowrap text-white drop-shadow-md sm:text-4xl lg:text-6xl">
                  {title}
                </h2>
              )}
              <HeroRatesInfos movie={movie} genreTable={genreTable} />
              <p className="mt-2 line-clamp-3 max-w-xl text-sm leading-relaxed text-white/85 drop-shadow-sm lg:mt-3 lg:max-w-2xl lg:text-lg">
                {movie.overview}
              </p>
            </div>

            {/* Actions: primary Watch + Trailer + Save. */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
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
                />
              )}

              {/* SaveButton only reads shared fields (id, title/name, overview,
                  artwork) via toWatchedItem; the trending Movie carries them all. */}
              <SaveButton
                media={media as unknown as MovieDetails & SeriesDetails}
              />
            </div>
          </div>

          <div className="hidden lg:flex">
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
    </div>
  )
}
