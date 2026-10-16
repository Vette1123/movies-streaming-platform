import React from 'react'
import Link from 'next/link'

import { MovieGenre } from '@/types/movie-genre'
import { SEARCH_ACTOR_GOOGLE } from '@/lib/constants'
import { aboutHeading } from '@/lib/seo-title'
import { cn } from '@/lib/utils'
import { Icons } from '@/components/icons'
import { GenreChips } from '@/components/media/genre-chips'

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
  overview: string
  genres?: MovieGenre[]
  mediaType: 'movie' | 'tv'
  extraInfo: ExtraInfoRow[]
}

// Shared body for the movie and series "extra info" detail panels — the two were
// ~95% identical (only field names, the formatter, and the media type differed).
//
// The title, tagline, chips and score row used to open this panel under a plain
// <h1>. They belong to the hero now (components/details-hero.tsx), set in the
// wordmark the homepage uses, so this panel starts at the synopsis under a
// section heading in the same type as "Cast" below it.
export const DetailsExtraInfoLayout = ({
  title,
  overview,
  genres,
  mediaType,
  extraInfo,
}: DetailsExtraInfoLayoutProps) => {
  return (
    <section aria-labelledby="details-about">
      <h2
        id="details-about"
        className="mb-3 text-base font-semibold md:text-xl lg:text-2xl"
      >
        {aboutHeading(title)}
      </h2>
      <p className="max-w-[68ch] text-sm leading-relaxed text-foreground/90 sm:text-base lg:text-lg">
        {overview}
      </p>
      <GenreChips genres={genres} mediaType={mediaType} className="mt-5" />
      {/* A definition list: these are labelled facts, and a screen reader
          announces them as pairs. Label column sized to its longest label
          rather than half the panel, so a value sits next to its name instead
          of across a gutter. */}
      <dl className="my-5 grid max-w-xl grid-cols-[auto_1fr] gap-x-8 gap-y-2.5 text-sm sm:text-base">
        {extraInfo.map((info) => (
          <React.Fragment key={info.name}>
            <dt className="text-muted-foreground">{info.name}</dt>
            <dd className="font-medium">
              {info.isLink ? (
                <Link
                  href={`${SEARCH_ACTOR_GOOGLE}${info.value}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex w-fit items-center gap-1 transition-colors hover:text-cyan-200"
                >
                  <span className="underline underline-offset-4">
                    {info.value}
                  </span>
                  <Icons.arrowRight className="size-4 transition-transform group-hover:translate-x-1 motion-reduce:transition-none" />
                </Link>
              ) : (
                <span className={cn('tabular-nums', info.className)}>
                  {info.value}
                </span>
              )}
            </dd>
          </React.Fragment>
        ))}
      </dl>
    </section>
  )
}
