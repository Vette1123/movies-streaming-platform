import React, { Suspense } from 'react'

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
import { MediaListFallback } from '@/components/media/media-list-fallback'

interface MediaListPageProps {
  media: MediaResponse
  getPopularMediaAction: PopularMediaAction<MediaResponse>
  queryKey: typeof QUERY_KEYS.SERIES_KEY | typeof QUERY_KEYS.MOVIES_KEY
  config: MediaListPageConfig
}

// Shared body for the /movies and /tv-shows browse pages — section shell,
// collection + breadcrumb JSON-LD, and the filterable infinite grid.
//
// The <h1> and the description live HERE, in the server component, not inside
// MediaContent: the filter subtree reads the URL via nuqs/useSearchParams and so
// bails to client-side rendering during the static prerender. Anything rendered
// inside it is absent from the HTML — which is why these two pages shipped with
// no heading and no crawlable content at all.
export const MediaListPage = ({
  media,
  getPopularMediaAction,
  queryKey,
  config,
}: MediaListPageProps) => {
  const url = `${siteConfig.websiteURL}${config.path}`
  const mediaType = queryKey === QUERY_KEYS.MOVIES_KEY ? 'movie' : 'tv'
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
      <div className="mb-6 space-y-2">
        <h1 className="text-3xl font-bold tracking-tight lg:text-4xl">
          {config.title}
        </h1>
        <p className="text-muted-foreground max-w-2xl">{config.description}</p>
      </div>
      <Suspense
        fallback={<MediaListFallback media={media} mediaType={mediaType} />}
      >
        <MediaContent
          media={media}
          getPopularMediaAction={getPopularMediaAction}
          queryKey={queryKey}
          enableFilters={true}
          filterLayout="sidebar"
        />
      </Suspense>
    </section>
  )
}
