import React from 'react'
import Link from 'next/link'

import { MovieDetails } from '@/types/movie-details'
import { SEARCH_ACTOR_GOOGLE } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { HeroRatesInfos } from '@/components/header/hero-rates-info'
import { Icons } from '@/components/icons'
import { movieExtraInfoFormatter } from '@/components/media/extra-info'
import { GenreChips } from '@/components/media/genre-chips'
import { NewBadgeWhenRecent } from '@/components/new-badge-when-recent'

export const DetailsExtraInfo = ({
  movie,
  director,
}: {
  movie: MovieDetails
  director: string | undefined
}) => {
  const extraInfo = movieExtraInfoFormatter(movie, director)
  return (
    <section>
      <NewBadgeWhenRecent
        date={movie.release_date}
        className="relative left-0 top-0 mb-2 px-2.5 py-1 text-[11px] lg:text-xs"
      />
      <h1 className="text-sm font-bold lg:text-3xl">{movie.title}</h1>
      {movie.tagline && (
        <p className="text-muted-foreground mt-1 text-xs italic lg:text-base">
          {movie.tagline}
        </p>
      )}
      <HeroRatesInfos movieDetails={movie} />
      <p className="prose-invert text-xs font-semibold lg:text-lg">
        {movie.overview}
      </p>
      <GenreChips genres={movie.genres} mediaType="movie" className="mt-4" />
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
