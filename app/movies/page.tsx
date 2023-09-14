import React from 'react'
import { Metadata } from 'next'
import { getPopularMovies } from '@/services/movies'

import { siteConfig } from '@/config/site'
import { QUERY_KEYS } from '@/lib/queryKeys'
import { MediaContent } from '@/components/media/media-content'

export const metadata: Metadata = {
  title: 'Movies',
  description: 'Movies List',
  metadataBase: new URL('/movies', process.env.NEXT_PUBLIC_BASE_URL),
  openGraph: {
    images: [siteConfig.personalLogo, siteConfig.links.twitter],
  },
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
