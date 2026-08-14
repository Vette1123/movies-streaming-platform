import React from 'react'
import Link from 'next/link'

import { Credit } from '@/types/credit'
import { SEARCH_ACTOR_GOOGLE } from '@/lib/constants'
import { getPosterImageURL } from '@/lib/utils'
import { BlurredImage, POSTER_QUALITY } from '@/components/blurred-image'

export const DetailsCredits = ({ movieCredits }: { movieCredits: Credit }) => {
  return (
    <>
      <h2 className="text-base font-semibold md:text-xl lg:text-2xl">Cast</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5">
        {movieCredits?.cast?.slice(0, 10)?.map((cast) => (
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
                  // 10vw above lg, not 15: the cast grid is 5 columns of a
                  // COLUMN of the page, not of the page — measured at 192 CSS
                  // px on a movie page and 128 on a series page (which gives a
                  // slice to the season navigator), where 15vw claimed 227 and
                  // bought a 500px file for a 128px box.
                  sizes="(max-width: 640px) 45vw, (max-width: 768px) 30vw, (max-width: 1024px) 25vw, 10vw"
                  // A portrait, not a backdrop: the `intro` reveal below would
                  // otherwise hand it the 65 tuned for full-bleed photos under
                  // a scrim. These are faces at thumbnail size.
                  quality={POSTER_QUALITY}
                  intro
                />
              </div>
            ) : (
              <div className="bg-muted relative aspect-2/3 w-full rounded-lg shadow-md"></div>
            )}
            <p className="mt-1 truncate text-sm sm:text-base">{cast.name}</p>
            {cast.character && (
              <p className="text-muted-foreground truncate text-xs">
                {cast.character}
              </p>
            )}
          </Link>
        ))}
      </div>
    </>
  )
}
