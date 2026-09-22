import React from 'react'
import Link from 'next/link'

import { MovieGenre } from '@/types/movie-genre'
import { SEARCH_ACTOR_GOOGLE } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { AiringChip } from '@/components/airing-chip'
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
  // TMDB next_episode_to_air.air_date — series only; drives the airing chip.
  nextAirDate?: string | null
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
  nextAirDate,
  tagline,
  overview,
  genres,
  mediaType,
  heroRates,
  extraInfo,
}: DetailsExtraInfoLayoutProps) => {
  return (
    <section>
      {/* Reserve the badge row so the mount-gated "New" and airing chips don't
          shove the title down post-hydration (CLS). `static` keeps them in
          normal flow inside the reserved box instead of the base `absolute`. */}
      <div className="mb-2 flex min-h-7 flex-wrap items-center gap-2">
        <NewBadgeWhenRecent date={badgeDate} className="static" />
        <AiringChip airDate={nextAirDate} className="static" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
        {title}
      </h1>
      {tagline && (
        <p className="mt-1 text-sm text-muted-foreground italic sm:text-base lg:text-lg">
          {tagline}
        </p>
      )}
      {heroRates}
      <p className="max-w-[68ch] text-sm leading-relaxed font-medium prose-invert sm:text-base lg:text-lg">
        {overview}
      </p>
      <GenreChips genres={genres} mediaType={mediaType} className="mt-4" />
      <div className="my-4 flex max-w-lg flex-col space-y-1">
        {extraInfo.map((info) => (
          <div
            key={info.name}
            className="grid grid-cols-2 gap-3 text-sm font-semibold sm:text-base lg:text-lg"
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
                  <Icons.arrowRight className="size-5 transition-transform group-hover:translate-x-2" />
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
