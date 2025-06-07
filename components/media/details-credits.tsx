import React from 'react'
import Link from 'next/link'

import { Credit } from '@/types/credit'
import { SEARCH_ACTOR_GOOGLE } from '@/lib/constants'
import { getPosterImageURL } from '@/lib/utils'
import { BlurredImage } from '@/components/blurred-image'

export const DetailsCredits = ({ movieCredits }: { movieCredits: Credit }) => {
  return (
    <>
      <h2 className="text-base font-semibold md:text-xl lg:text-2xl">Cast</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-6">
        {movieCredits?.cast?.slice(0, 6)?.map((cast) => (
          <Link
            href={`${SEARCH_ACTOR_GOOGLE}${cast.name}`}
            key={cast.id}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col transition-all duration-300 ease-in-out hover:scale-105"
          >
            {cast.profile_path ? (
              <div className="relative aspect-2/3 w-full overflow-hidden rounded-lg shadow-md">
                <BlurredImage
                  src={getPosterImageURL(cast.profile_path)}
                  alt={cast.name}
                  fill
                  className="cursor-pointer object-cover"
                  sizes="(max-width: 640px) 45vw, (max-width: 768px) 30vw, (max-width: 1024px) 25vw, 15vw"
                  intro
                />
              </div>
            ) : (
              <div className="relative aspect-2/3 w-full rounded-lg bg-gray-800 shadow-md"></div>
            )}
            <p className="mt-1 truncate text-sm sm:text-base">{cast.name}</p>
          </Link>
        ))}
      </div>
    </>
  )
}
