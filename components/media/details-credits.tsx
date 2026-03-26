import React from 'react'
import Link from 'next/link'
import { UserRound } from 'lucide-react'

import { Credit } from '@/types/credit'
import { getPosterImageURL } from '@/lib/utils'
import { BlurredImage } from '@/components/blurred-image'

export const DetailsCredits = ({ movieCredits }: { movieCredits: Credit }) => {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold lg:text-2xl">Cast</h2>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
        {movieCredits?.cast?.slice(0, 12)?.map((cast) => (
          <Link
            href={`/person/${cast.id}`}
            key={cast.id}
            className="group flex flex-col"
          >
            <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-white/5 shadow-md transition-transform duration-300 group-hover:scale-105">
              {cast.profile_path ? (
                <BlurredImage
                  src={getPosterImageURL(cast.profile_path)}
                  alt={cast.name}
                  fill
                  className="cursor-pointer object-cover"
                  sizes="(max-width: 640px) 30vw, (max-width: 1024px) 20vw, 12vw"
                  intro
                />
              ) : (
                <div className="flex size-full items-center justify-center">
                  <UserRound className="size-10 text-white/20" strokeWidth={1} />
                </div>
              )}
              {/* hover overlay with character name */}
              <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                <p className="w-full px-2 pb-2 text-center text-xs font-medium text-white/90">
                  {cast.character}
                </p>
              </div>
            </div>
            <p className="mt-1.5 truncate text-xs font-semibold sm:text-sm">
              {cast.name}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {cast.character}
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
}
