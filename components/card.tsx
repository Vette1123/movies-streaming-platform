'use client'

import React from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { CalendarDays, Check, Play } from 'lucide-react'

import { MediaType } from '@/types/media'
import { ItemType } from '@/types/movie-result'
import { trackMediaCardClicked } from '@/lib/analytics'
import { getMediaReleaseDate, getMediaTitle } from '@/lib/media'
import { cn, dateFormatter, getPosterImageURL, itemRedirect } from '@/lib/utils'
import { useCompletedMedia } from '@/hooks/use-completed-media'
import { useMounted } from '@/hooks/use-mounted'
import { chipVariants } from '@/components/ui/chip'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import { BlurredImage } from '@/components/blurred-image'
import { MediaPosterFallback } from '@/components/media/media-poster-fallback'
import { ScoreChip } from '@/components/media/score-chip'
import { NewBadgeWhenRecent } from '@/components/new-badge-when-recent'

interface CardProps {
  item: MediaType
  itemType?: ItemType
  isTruncateOverview?: boolean
}

const CardComponent = ({
  item,
  itemType = 'movie',
  isTruncateOverview = true,
}: CardProps) => {
  const title = getMediaTitle(item)
  const releaseDate = getMediaReleaseDate(item)
  const year = releaseDate?.slice(0, 4)
  const overview = item?.overview ?? ''
  // Prefer the real IMDb score (attached to list items server-side) and mark it
  // with the IMDb wordmark; the TMDB average is the labelled-star fallback.
  const imdbRating = item?.imdbRating

  // Read-only "watched" indicator. localStorage is client-only, so gate on mount
  // to stay hydration-safe (matches NewBadgeWhenRecent). Only movies carry a
  // title-level completed flag; series completion is tracked per-episode.
  const isMounted = useMounted()
  const { isMovieCompleted } = useCompletedMedia()
  const watched = isMounted && itemType === 'movie' && isMovieCompleted(item.id)

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <Link
          href={`${itemRedirect(itemType)}/${item.id}`}
          // Block-level so the poster's `w-full` resolves against the grid track
          // / rail item width instead of an inline <a>'s shrink-to-fit box.
          className="block w-full"
          // Viewport auto-prefetch fires one RSC request per card; a homepage
          // of carousels mounts 100+ cards at once and trips the CF rate-limit
          // (100 req/10s on detail paths) → 1015 on our own page load. Prefetch
          // on hover only — pairs with the HoverCard, keeps nav snappy.
          prefetch={false}
          onClick={() =>
            trackMediaCardClicked({
              media_id: item.id,
              media_type: itemType === 'tv' ? 'tv' : 'movie',
              title,
              source: 'card',
            })
          }
        >
          {/* Enable hover interactions on any device that actually has a hover
              pointer (mouse/trackpad) — NOT gated on width. The old `lg:` gate
              killed the hover lift + details HoverCard on desktop windows under
              1024px (small laptops, non-maximized windows). `hover:hover` keeps
              touch clean (no sticky-hover overlay; the tap still navigates via
              the parent Link). */}
          <div className="group/card pointer-events-none [@media(hover:hover)]:pointer-events-auto">
            {/* Hover lift+scale via a warm, gently-underdamped framer spring (scale
                1.05, y -10; stiffness 200 / damping 21 / mass 1 → ζ≈0.74, ~0.45s
                period). The earlier stiffness-300/mass-0.6 spring was fast and tight,
                so a small 1.03/-6 move read as "instant and subtle"; a near-critical
                spring fixed the snap but felt lifeless. Softer stiffness + full mass
                slows the onset, and a sub-critical damping lets the card ease up,
                kiss just past the target, and settle soft — the small overshoot is
                what reads as "warm and alive" rather than mechanical.
                A real spring is velocity-aware and interruptible — hovering out
                mid-animation settles from current velocity instead of replaying a
                fixed CSS curve backward, the smoothness the pure-CSS `linear()`
                approximation lost. framer is already on these pages (carousel/hero/
                nav) so it adds no bundle. ONE motion component per card (whileHover
                on this node, not a parent orchestrator) — halves the motion
                instances across a 100+ card grid vs a variant-propagating wrapper.
                Shadow+ring stay CSS group-hover (500ms ease-out to match the spring's
                unhurried feel); framer owns only the transform. */}
            <motion.div
              whileHover={{ scale: 1.05, y: -10 }}
              transition={{
                type: 'spring',
                stiffness: 200,
                damping: 21,
                mass: 1,
              }}
              className="group-hover/card:ring-primary/60 relative cursor-pointer rounded-lg shadow-lg ring-1 ring-transparent transition-shadow duration-500 ease-out will-change-transform group-hover/card:shadow-2xl"
            >
              <NewBadgeWhenRecent date={releaseDate} />
              {watched && (
                <span
                  className={cn(
                    chipVariants({ variant: 'success' }),
                    'pointer-events-none absolute top-2 right-2 z-10 grid size-6 place-items-center p-0'
                  )}
                  aria-label="Watched"
                  title="Watched"
                >
                  <Check className="size-3.5" strokeWidth={3} aria-hidden />
                </span>
              )}
              {item?.poster_path ? (
                <BlurredImage
                  src={`${getPosterImageURL(item.poster_path)}`}
                  alt={title ?? 'Poster'}
                  width={250}
                  height={375}
                  className="rounded-lg object-cover transition-transform duration-500 ease-out group-hover/card:scale-105"
                />
              ) : (
                <MediaPosterFallback
                  itemType={itemType}
                  title={title}
                  className="w-[250px] max-w-full"
                />
              )}

              {/* Hover scrim + play affordance (desktop only — mobile navigates on tap) */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-black/35 opacity-0 transition-opacity duration-500 ease-out group-hover/card:opacity-100">
                <span className="bg-primary/90 text-primary-foreground grid size-12 translate-y-1 place-items-center rounded-full shadow-lg backdrop-blur-sm transition-transform duration-300 group-hover/card:translate-y-0">
                  <Play
                    className="size-5 translate-x-0.5 fill-current"
                    aria-hidden
                  />
                </span>
              </div>

              {/* Bottom gradient with rating + year for at-a-glance context */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-2 rounded-b-lg bg-gradient-to-t from-black/85 to-transparent px-3 pt-8 pb-2.5 text-[11px] font-medium text-white opacity-0 transition-opacity duration-500 ease-out group-hover/card:opacity-100">
                <ScoreChip
                  imdbRating={imdbRating}
                  voteAverage={item.vote_average}
                  size="sm"
                />
                {year && <span className="text-white/60">· {year}</span>}
              </div>
            </motion.div>
          </div>
        </Link>
      </HoverCardTrigger>
      <HoverCardContent className="hidden w-80 md:block" side="right">
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm leading-tight font-semibold">
              {title}
              {year ? ` (${year})` : ''}
            </h4>
            <ScoreChip
              imdbRating={imdbRating}
              voteAverage={item.vote_average}
              size="md"
            />
          </div>
          {overview && (
            <p className="text-muted-foreground text-sm">
              {isTruncateOverview && overview.length > 150
                ? `${overview.slice(0, 150)}…`
                : overview.slice(0, 400)}
            </p>
          )}
          <div className="text-muted-foreground flex items-center pt-1 text-xs">
            <CalendarDays className="mr-2 size-4 opacity-70" />
            {dateFormatter(releaseDate ?? '', true)}
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}

// Homepage and browse/genre grids mount 100+ Cards. Memoize so a parent
// re-render (infinite-scroll fetch, a completion-store update, filter change)
// only re-renders the cards whose props actually changed, not the whole grid.
export const Card = React.memo(CardComponent)
