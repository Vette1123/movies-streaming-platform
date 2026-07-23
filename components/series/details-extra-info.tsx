import React from 'react'
import Link from 'next/link'

import { SeriesDetails } from '@/types/series-details'
import { SEARCH_ACTOR_GOOGLE } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { HeroRatesInfos } from '@/components/header/hero-rates-info'
import { Icons } from '@/components/icons'
import { seriesExtraInfoFormatter } from '@/components/media/extra-info'
import { GenreChips } from '@/components/media/genre-chips'
import { NewBadgeWhenRecent } from '@/components/new-badge-when-recent'

interface SeriesDetailsExtraInfoProps {
  series: SeriesDetails
  director: string | undefined
}

export const SeriesDetailsExtraInfo = ({
  series,
  director,
}: SeriesDetailsExtraInfoProps) => {
  const extraInfo = seriesExtraInfoFormatter(series, director)
  return (
    <section>
      {/* Reserve the badge row so the mount-gated "New" chip doesn't shove the
          title down post-hydration (CLS). `static` keeps it in normal flow
          inside the reserved box instead of the base `absolute`. */}
      <div className="mb-2 min-h-[1.75rem]">
        <NewBadgeWhenRecent
          date={series.first_air_date}
          className="static px-2.5 py-1 text-[11px] lg:text-xs"
        />
      </div>
      <h1 className="text-sm font-bold lg:text-3xl">{series.name}</h1>
      {series.tagline && (
        <p className="text-muted-foreground mt-1 text-xs italic lg:text-base">
          {series.tagline}
        </p>
      )}
      <HeroRatesInfos seriesDetails={series} />
      <p className="prose-invert text-xs font-semibold lg:text-lg">
        {series.overview}
      </p>
      <GenreChips genres={series.genres} mediaType="tv" className="mt-4" />
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
