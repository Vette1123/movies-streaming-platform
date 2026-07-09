import React from 'react'

import { MovieDetails } from '@/types/movie-details'
import { getImageURL } from '@/lib/utils'
import { BlurredImage } from '@/components/blurred-image'

/**
 * Franchise context banner. TMDB ships `belongs_to_collection` inside the movie
 * payload we already fetch, so this is a zero-cost enrichment. Informational
 * only (there's no in-app collection route yet), so it's not a link.
 */
export const CollectionBanner = ({ movie }: { movie: MovieDetails }) => {
  const collection = movie.belongs_to_collection
  if (!collection?.name) return null

  const backdrop = collection.backdrop_path || collection.poster_path

  return (
    <div className="relative mt-10 overflow-hidden rounded-xl border border-white/10 shadow-lg">
      {backdrop && (
        <BlurredImage
          src={getImageURL(backdrop)}
          alt={collection.name}
          fill
          sizes="(min-width: 1024px) 1024px, 100vw"
          className="object-cover object-center"
        />
      )}
      <div className="absolute inset-0 bg-linear-to-r from-slate-950/90 via-slate-950/70 to-slate-950/30" />
      <div className="relative flex flex-col gap-1 p-5 lg:p-7">
        <span className="text-[11px] font-semibold tracking-[0.2em] text-cyan-300 uppercase">
          Part of the collection
        </span>
        <p className="text-lg font-bold text-white lg:text-2xl">
          {collection.name}
        </p>
      </div>
    </div>
  )
}
