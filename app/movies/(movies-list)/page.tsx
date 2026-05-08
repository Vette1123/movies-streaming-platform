import React from 'react'
import { Metadata } from 'next'
import { getPopularMovies } from '@/services/movies'

import { siteConfig } from '@/config/site'
import { QUERY_KEYS } from '@/lib/queryKeys'
import {
  breadcrumbJsonLd,
  collectionPageJsonLd,
  JsonLd,
} from '@/lib/structured-data'
import { MediaContent } from '@/components/media/media-content'

export const revalidate = 28800

const MOVIES_TITLE = `Movies — Browse Popular, Trending & Top Rated`
const MOVIES_DESCRIPTION =
  'Browse popular, trending, and top-rated movies. Filter by genre, year, and rating to find your next watch on Reely.'
const MOVIES_URL = `${siteConfig.websiteURL}/movies`

export const metadata: Metadata = {
  title: 'Movies',
  description: MOVIES_DESCRIPTION,
  keywords: [
    'popular movies',
    'trending movies',
    'top rated movies',
    'new releases',
    'movie tracker',
    ...siteConfig.keywords,
  ],
  alternates: {
    canonical: '/movies',
  },
  openGraph: {
    title: MOVIES_TITLE,
    description: MOVIES_DESCRIPTION,
    url: MOVIES_URL,
    type: 'website',
    images: [
      {
        url: '/opengraph-image.png',
        width: siteConfig.openGraph.images.default.width,
        height: siteConfig.openGraph.images.default.height,
        alt: siteConfig.openGraph.images.default.alt,
        type: siteConfig.openGraph.images.default.type,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: MOVIES_TITLE,
    description: MOVIES_DESCRIPTION,
    images: ['/opengraph-image.png'],
  },
}

async function Movies() {
  const movies = await getPopularMovies()
  return (
    <section className="container h-full py-20 lg:py-36">
      <JsonLd
        data={collectionPageJsonLd({
          name: MOVIES_TITLE,
          description: MOVIES_DESCRIPTION,
          url: MOVIES_URL,
        })}
      />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', url: '/' },
          { name: 'Movies', url: '/movies' },
        ])}
      />
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
