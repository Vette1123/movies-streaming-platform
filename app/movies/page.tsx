import React from 'react'
import { Metadata } from 'next'
import { getPopularMovies } from '@/services/movies'

import { QUERY_KEYS } from '@/lib/queryKeys'
import { MediaContent } from '@/components/media/media-content'

export const metadata: Metadata = {
  title: 'Movies',
  description: 'Movies List',
}

async function Movies() {
  const movies = await getPopularMovies()
  return (
    <section className="container h-full py-20 lg:py-36">
      <MediaContent
        media={movies}
        getPopularMediaAction={getPopularMovies}
        queryKey={QUERY_KEYS.MOVIES_KEY}
      />
    </section>
  )
}

export default Movies
