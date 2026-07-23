'use client'

import React from 'react'
import Link from 'next/link'
import { CalendarDays, Check, Film, Play, Tv } from 'lucide-react'

import { MediaType } from '@/types/media'
import { ItemType } from '@/types/movie-result'
import { trackMediaCardClicked } from '@/lib/analytics'
import { dateFormatter, getPosterImageURL, itemRedirect } from '@/lib/utils'
import { useCompletedMedia } from '@/hooks/use-completed-media'
import { useMounted } from '@/hooks/use-mounted'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import { BlurredImage } from '@/components/blurred-image'
import { NewBadgeWhenRecent } from '@/components/new-badge-when-recent'
import { ScoreChip } from '@/components/media/score-chip'

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
  const title = item?.title || item?.name
  const releaseDate = item?.release_date || item?.first_air_date
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
            {/* Hover lift+scale in pure CSS (was framer CARD_VARIANT: scale 1.03,
                y -6, spring). Tailwind v4 drives translate/scale independently;
                the back-ease approximates the spring's slight overshoot. Dropping
                framer here removes a motion component from 120+ grid instances. */}
            <div className="group-hover/card:ring-primary/60 relative cursor-pointer rounded-lg shadow-lg ring-1 ring-transparent transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] will-change-transform group-hover/card:-translate-y-1.5 group-hover/card:scale-[1.03] group-hover/card:shadow-2xl">
              <NewBadgeWhenRecent date={releaseDate} />
              {watched && (
                <span
                  className="pointer-events-none absolute top-2 right-2 z-10 grid size-6 place-items-center rounded-full border border-white/20 bg-emerald-500/90 text-white shadow-lg ring-1 ring-emerald-300/30 backdrop-blur-md"
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
                <div className="bg-muted text-muted-foreground flex aspect-2/3 w-[250px] max-w-full flex-col items-center justify-center gap-2 rounded-lg p-4 text-center">
                  {itemType === 'tv' ? (
                    <Tv className="size-8 opacity-60" aria-hidden />
                  ) : (
                    <Film className="size-8 opacity-60" aria-hidden />
                  )}
                  <span className="line-clamp-3 text-xs font-medium">
                    {title}
                  </span>
                </div>
              )}

              {/* Hover scrim + play affordance (desktop only — mobile navigates on tap) */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-black/35 opacity-0 transition-opacity duration-300 group-hover/card:opacity-100">
                <span className="bg-primary/90 text-primary-foreground grid size-12 translate-y-1 place-items-center rounded-full shadow-lg backdrop-blur-sm transition-transform duration-300 group-hover/card:translate-y-0">
                  <Play
                    className="size-5 translate-x-0.5 fill-current"
                    aria-hidden
                  />
                </span>
              </div>

              {/* Bottom gradient with rating + year for at-a-glance context */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-2 rounded-b-lg bg-gradient-to-t from-black/85 to-transparent px-3 pt-8 pb-2.5 text-[11px] font-medium text-white opacity-0 transition-opacity duration-300 group-hover/card:opacity-100">
                <ScoreChip
                  imdbRating={imdbRating}
                  voteAverage={item.vote_average}
                  size="sm"
                />
                {year && <span className="text-white/60">· {year}</span>}
              </div>
            </div>
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
