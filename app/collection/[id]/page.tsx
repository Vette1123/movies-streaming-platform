import React from 'react'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import {
  getAllTimeTopRatedMovies,
  getCollectionById,
  getLatestTrendingMovies,
  getMovieDetailsById,
  getPopularMovies,
} from '@/services/movies'

import { PageDetailsProps } from '@/types/page-details'
import { siteConfig } from '@/config/site'
import {
  buildCollectionStaticParams,
  buildMediaStaticParams,
} from '@/lib/media-page'
import { getImageURL } from '@/lib/utils'
import { CollectionView } from '@/components/collection/collection-view'

// Collections are static franchise metadata — safe to cache long and let CI
// repopulate. Mirrors the movie-details revalidate window.
export const revalidate = 86400

// `output: 'export'` requires false. An id outside the prerendered set is not
// lost: no asset matches it, so cloudflare/worker.js takes the request and
// serves app/collection-fallback with the real metadata injected.
export const dynamicParams = false

// Prerender the franchises reachable from the movies we already prebuild. This
// route used to have no generateStaticParams at all, which made it the site's
// last fully-dynamic page: every hit rendered on the Worker, and once the
// detail-page scrapers were challenged away /collection/<id> went straight to
// the top of the 503 list. The ids come from `belongs_to_collection` on movie
// details — see buildCollectionStaticParams for why that costs almost nothing.
export function generateStaticParams() {
  return buildCollectionStaticParams(
    () =>
      buildMediaStaticParams({
        popular: getPopularMovies,
        topRated: getAllTimeTopRatedMovies,
        trending: getLatestTrendingMovies,
      }),
    getMovieDetailsById
  )
}

export async function generateMetadata(
  props: PageDetailsProps
): Promise<Metadata> {
  const params = await props.params
  let collection
  try {
    collection = await getCollectionById(params.id)
  } catch {
    notFound()
  }
  if (!collection?.id) notFound()

  const description =
    collection.overview?.slice(0, 200) ||
    `Every film in the ${collection.name} on ${siteConfig.name}.`
  const canonicalPath = `/collection/${params.id}`
  const image = collection.backdrop_path
    ? getImageURL(collection.backdrop_path)
    : undefined

  return {
    title: collection.name,
    description,
    alternates: { canonical: canonicalPath },
    openGraph: {
      type: 'website',
      title: collection.name,
      description,
      url: `${siteConfig.websiteURL}${canonicalPath}`,
      images: image
        ? [{ url: image, width: 1280, height: 720, alt: collection.name }]
        : undefined,
    },
  }
}

const CollectionPage = async (props: PageDetailsProps) => {
  const params = await props.params
  let collection
  try {
    collection = await getCollectionById(params.id)
  } catch {
    notFound()
  }
  if (!collection?.id) notFound()

  return <CollectionView collection={collection} />
}

export default CollectionPage
