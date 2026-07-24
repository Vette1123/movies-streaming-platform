import React from 'react'
import Link from 'next/link'

import { MovieGenre } from '@/types/movie-genre'
import { SEARCH_ACTOR_GOOGLE } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { Icons } from '@/components/icons'
import { GenreChips } from '@/components/media/genre-chips'
import { NewBadgeWhenRecent } from '@/components/new-badge-when-recent'

// One row of the key/value info grid. `value` is a string for movies and can be
// a number for series counts; only non-numeric people fields ever set isLink.
export interface ExtraInfoRow {
  name: string
  value: string | number | undefined
  className?: string
  isLink?: boolean
}

interface DetailsExtraInfoLayoutProps {
  title: string
  // Date that drives the mount-gated "New" badge (release / first-air).
  badgeDate?: string
  tagline?: string
  overview: string
  genres?: MovieGenre[]
  mediaType: 'movie' | 'tv'
  // Rendered <HeroRatesInfos .../> — passed in so this layout stays agnostic of
  // the movie-vs-series discriminated props that component takes.
  heroRates: React.ReactNode
  extraInfo: ExtraInfoRow[]
}

// Shared body for the movie and series "extra info" detail panels — the two were
// ~95% identical (only field names, the formatter, and the media type differed).
export const DetailsExtraInfoLayout = ({
  title,
  badgeDate,
  tagline,
  overview,
  genres,
  mediaType,
  heroRates,
  extraInfo,
}: DetailsExtraInfoLayoutProps) => {
  return (
    <section>
      {/* Reserve the badge row so the mount-gated "New" chip doesn't shove the
          title down post-hydration (CLS). `static` keeps it in normal flow
          inside the reserved box instead of the base `absolute`. */}
      <div className="mb-2 min-h-[1.75rem]">
        <NewBadgeWhenRecent date={badgeDate} className="static" />
      </div>
      <h1 className="text-sm font-bold lg:text-3xl">{title}</h1>
      {tagline && (
        <p className="text-muted-foreground mt-1 text-xs italic lg:text-base">
          {tagline}
        </p>
      )}
      {heroRates}
      <p className="prose-invert text-xs font-semibold lg:text-lg">
        {overview}
      </p>
      <GenreChips genres={genres} mediaType={mediaType} className="mt-4" />
      <div className="my-4 flex max-w-lg flex-col space-y-1">
        {extraInfo.map((info) => (
          <div
            key={info.name}
            className="grid grid-cols-2 text-sm font-semibold lg:text-lg"
          >
            <p className="text-muted-foreground">{info.name}</p>
            {info.isLink ? (
              <Link
                href={`${SEARCH_ACTOR_GOOGLE}${info.value}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group w-fit transition-all ease-in-out hover:text-cyan-200"
              >
                <span className="inline-flex items-center gap-1">
                  <span className="underline underline-offset-4">
                    {info.value}
                  </span>
                  <Icons.arrowRight className="h-5 w-5 transition-transform group-hover:translate-x-2" />
                </span>
              </Link>
            ) : (
              <p className={cn(info.className)}>{info.value}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
