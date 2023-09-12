import React, { Suspense } from 'react'

import { MediaType } from '@/types/media'
import { MovieCredits, MovieDetails } from '@/types/movie-details'
import { Movie } from '@/types/movie-result'
import { getPosterImageURL } from '@/lib/utils'
import { BlurredImage } from '@/components/blurred-image'
import { List } from '@/components/list'
import { SliderHorizontalListLoader } from '@/components/loaders/slider-horizontal-list-loader'
import { DetailsCredits } from '@/components/media/details-credits'
import { DetailsExtraInfo } from '@/components/media/details-extra-info'

export const DetailsPageContent = ({
  movie,
  movieCredits,
  similarMovies,
  recommendedMovies,
}: {
  movie: MovieDetails
  movieCredits: MovieCredits
  similarMovies: Movie[]
  recommendedMovies: Movie[]
}) => {
  const director = movieCredits?.crew?.find((crew) => crew.job === 'Director')
    ?.name
  return (
    <section className="container max-w-screen-2xl pb-10 pt-12 lg:pb-20">
      <div className="flex flex-col-reverse gap-8 lg:flex-row">
        <div className="hidden lg:block">
          <div className="relative min-h-[600px] w-[400px]">
            <BlurredImage
              src={getPosterImageURL(movie.poster_path)}
              alt={movie.title}
              className="h-full w-full rounded-lg object-fill shadow-lg lg:object-cover"
              fill
              sizes="(min-width: 1024px) 1024px, 100vw"
              intro
            />
          </div>
        </div>
        <section className="flex flex-col gap-4">
          <DetailsExtraInfo movie={movie} director={director} />
          <DetailsCredits movieCredits={movieCredits} />
        </section>
        <div className="max-w-xs flex-col lg:flex-row">
          Lorem ipsum dolor sit amet consectetur adipisicing elit. Corrupti
          itaque natus iusto aliquid inventore officiis recusandae voluptate!
          Harum rem a voluptatum eos vel, praesentium perferendis quidem
          corporis laborum odit nihil, distinctio voluptas repellendus illum
          nostrum nobis quis culpa accusamus quam ullam, tenetur eius maiores.
          Atque nobis deleniti reiciendis ratione obcaecati!
        </div>
      </div>
      <Suspense fallback={<SliderHorizontalListLoader />}>
        <List
          title="Recommended Movies"
          items={recommendedMovies as MediaType[]}
        />
      </Suspense>
      <Suspense fallback={<SliderHorizontalListLoader />}>
        <List title="Similar Movies" items={similarMovies as MediaType[]} />
      </Suspense>
    </section>
  )
}
