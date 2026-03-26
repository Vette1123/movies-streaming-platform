import React from 'react'
import Link from 'next/link'

import { MovieDetails } from '@/types/movie-details'
import { SEARCH_ACTOR_GOOGLE } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { HeroRatesInfos } from '@/components/header/hero-rates-info'
import { Icons } from '@/components/icons'
import { movieExtraInfoFormatter } from '@/components/media/extra-info'
import { Badge } from '@/components/ui/badge'

export const DetailsExtraInfo = ({
  movie,
  director,
}: {
  movie: MovieDetails
  director: string | undefined
}) => {
  const extraInfo = movieExtraInfoFormatter(movie, director)
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold leading-tight lg:text-4xl">
          {movie.title}
        </h1>
        {movie.imdb_id && (
          <Link
            href={`https://www.imdb.com/title/${movie.imdb_id}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Badge className="bg-yellow-400 text-black hover:bg-yellow-300">
              IMDb
            </Badge>
          </Link>
        )}
      </div>
      {movie.genres?.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {movie.genres.map((genre) => (
            <span
              key={genre.id}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-0.5 text-xs text-white/70"
            >
              {genre.name}
            </span>
          ))}
        </div>
      )}
      {movie.tagline && (
        <p className="text-sm italic text-muted-foreground lg:text-base">
          &ldquo;{movie.tagline}&rdquo;
        </p>
      )}
      <HeroRatesInfos movieDetails={movie} />
      <p className="text-sm leading-relaxed text-white/80 lg:text-base">
        {movie.overview}
      </p>
      <div className="my-4 flex max-w-lg flex-col divide-y divide-white/5">
        {extraInfo.filter((info) => info.value && info.value !== 'N/A').map((info) => (
          <div
            key={info.name}
            className="grid grid-cols-2 py-2 text-sm lg:text-base"
          >
            <p className="font-medium text-muted-foreground">{info.name}</p>
            {info.isLink ? (
              <Link
                href={`${SEARCH_ACTOR_GOOGLE}${info.value}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group w-fit transition-colors hover:text-cyan-300"
              >
                <span className="inline-flex items-center gap-1">
                  <span className="underline underline-offset-4">
                    {info.value}
                  </span>
                  <Icons.arrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            ) : (
              <p className={cn('font-medium', info.className)}>{info.value}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
