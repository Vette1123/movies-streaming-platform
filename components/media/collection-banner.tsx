import React from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import { MovieDetails } from '@/types/movie-details'
import { getImageURL } from '@/lib/utils'
import { BlurredImage } from '@/components/blurred-image'

/**
 * Franchise context banner. TMDB ships `belongs_to_collection` inside the movie
 * payload we already fetch, so this is a zero-cost enrichment. Links to the
 * in-app collection page (`/collection/{id}`) listing every film in the
 * franchise — hover lifts + brightens + slides the arrow so it reads as clickable.
 */
export const CollectionBanner = ({ movie }: { movie: MovieDetails }) => {
  const collection = movie.belongs_to_collection
  if (!collection?.name) return null

  const backdrop = collection.backdrop_path || collection.poster_path

  return (
    <Link
      href={`/collection/${collection.id}`}
      aria-label={`View the ${collection.name}`}
      className="group/collection focus-visible:ring-primary/60 relative mt-10 block overflow-hidden rounded-xl border border-white/10 shadow-lg transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-0.5 hover:shadow-2xl focus-visible:ring-2 focus-visible:outline-none"
    >
      {backdrop && (
        <BlurredImage
          src={getImageURL(backdrop)}
          alt={collection.name}
          fill
          // The banner is as wide as the details container, which caps at the
          // 2xl breakpoint less its gutters — measured at 1472 CSS px on a
          // 2560px window, not the 1024 this used to claim. Below that cap it
          // simply is the viewport width.
          sizes="(min-width: 1536px) 1472px, 100vw"
          className="object-cover object-center transition-transform duration-500 ease-out group-hover/collection:scale-105"
        />
      )}
      <div className="absolute inset-0 bg-linear-to-r from-slate-950/90 via-slate-950/70 to-slate-950/30 transition-colors duration-300 group-hover/collection:from-slate-950/95" />
      <div className="relative flex items-center justify-between gap-4 p-5 lg:p-7">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold tracking-[0.2em] text-cyan-300 uppercase">
            Part of the collection
          </span>
          <p className="text-lg font-bold text-white lg:text-2xl">
            {collection.name}
          </p>
          <span className="mt-1 flex items-center gap-1 text-xs font-medium text-white/60 transition-colors duration-300 group-hover/collection:text-white/90">
            View all films
            <ArrowRight className="size-3.5 transition-transform duration-300 group-hover/collection:translate-x-1" />
          </span>
        </div>
        <span className="text-primary bg-primary/15 ring-primary/30 grid size-11 shrink-0 place-items-center rounded-full ring-1 backdrop-blur-sm transition-transform duration-300 group-hover/collection:scale-110">
          <ArrowRight className="size-5" aria-hidden />
        </span>
      </div>
    </Link>
  )
}
