import React from 'react'
import { Metadata } from 'next'
import { getPopularMovies } from '@/services/movies'

import { siteConfig } from '@/config/site'
import { QUERY_KEYS } from '@/lib/queryKeys'
import { MediaContent } from '@/components/media/media-content'

const generateOgImageUrl = (title: string, description: string) =>
  `${siteConfig.websiteURL}/api/og?title=${encodeURIComponent(title)}&description=${encodeURIComponent(description)}`

export const metadata: Metadata = {
  title: 'Movies',
  description: 'Discover and explore popular movies, trending releases, and all-time favorites.',
  metadataBase: new URL('/movies', process.env.NEXT_PUBLIC_BASE_URL),
  openGraph: {
    title: 'Movies - ' + siteConfig.name,
    description: 'Discover and explore popular movies, trending releases, and all-time favorites.',
    url: '/movies',
    images: [
      {
        url: generateOgImageUrl('Movies', 'Discover and explore popular movies'),
        width: siteConfig.openGraph.images.default.width,
        height: siteConfig.openGraph.images.default.height,
        alt: 'Movies - ' + siteConfig.name,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Movies - ' + siteConfig.name,
    description: 'Discover and explore popular movies, trending releases, and all-time favorites.',
    images: [generateOgImageUrl('Movies', 'Discover and explore popular movies')],
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
        enableFilters={true}
        filterLayout="sidebar"
        title="Movies"
      />
    </section>
  )
}

export default Movies
