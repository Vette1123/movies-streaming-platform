import React from 'react'

import { MediaResponse } from '@/types/media'
import { PopularMediaAction } from '@/types/movie-result'
import { siteConfig } from '@/config/site'
import { MediaListPageConfig } from '@/lib/media-page'
import { QUERY_KEYS } from '@/lib/queryKeys'
import {
  breadcrumbJsonLd,
  collectionPageJsonLd,
  JsonLd,
} from '@/lib/structured-data'
import { MediaContent } from '@/components/media/media-content'

interface MediaListPageProps {
  media: MediaResponse
  getPopularMediaAction: PopularMediaAction<MediaResponse>
  queryKey: typeof QUERY_KEYS.SERIES_KEY | typeof QUERY_KEYS.MOVIES_KEY
  config: MediaListPageConfig
}

// Shared body for the /movies and /tv-shows browse pages — section shell,
// collection + breadcrumb JSON-LD, and the filterable infinite grid.
export const MediaListPage = ({
  media,
  getPopularMediaAction,
  queryKey,
  config,
}: MediaListPageProps) => {
  const url = `${siteConfig.websiteURL}${config.path}`
  return (
    <section className="container h-full py-20 lg:py-36">
      <JsonLd
        data={collectionPageJsonLd({
          name: config.ogTitle,
          description: config.description,
          url,
        })}
      />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', url: '/' },
          { name: config.title, url: config.path },
        ])}
      />
      <MediaContent
        media={media}
        getPopularMediaAction={getPopularMediaAction}
        queryKey={queryKey}
        enableFilters={true}
        filterLayout="sidebar"
        title={config.title}
      />
    </section>
  )
}
