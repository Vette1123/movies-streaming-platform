import React from 'react'
import { Metadata } from 'next'
import { getPopularMovies } from '@/services/movies'

import { MoviesContent } from '@/components/movie/movies-content'

export const metadata: Metadata = {
  title: 'Movies',
  description: 'Movies List',
}

async function Movies() {
  const movies = await getPopularMovies()
  return (
    <section className="container h-full py-20 lg:py-36">
      <MoviesContent
        movies={movies}
        getPopularMoviesAction={getPopularMovies}
      />
    </section>
  )
}

export default Movies
