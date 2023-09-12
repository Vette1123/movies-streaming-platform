'use client'

import React from 'react'
import { useInView } from 'react-intersection-observer'

import { MediaResponse, MediaType } from '@/types/media'
import { PopularMediaAction } from '@/types/movie-result'
import { QUERY_KEYS } from '@/lib/queryKeys'
import { useInfiniteScroll } from '@/hooks/use-infinite-scroll'
import { Card } from '@/components/card'

interface MediaContentProps {
  media: MediaResponse
  getPopularMediaAction: PopularMediaAction<MediaResponse>
  queryKey: typeof QUERY_KEYS.SERIES_KEY | typeof QUERY_KEYS.MOVIES_KEY
}

export const MediaContent = ({
  media,
  getPopularMediaAction,
  queryKey,
}: MediaContentProps) => {
  const [myRef, inView] = useInView()
  const { data, fetchNextPage } = useInfiniteScroll({
    media,
    popularMediaAction: getPopularMediaAction,
    queryKey,
  })

  React.useEffect(() => {
    if (inView) {
      fetchNextPage()
    }
  }, [inView, fetchNextPage])

  if (!data) return <div className="text-muted-foreground">No data found</div>
  const { pages } = data

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5 lg:gap-8">
      {pages &&
        pages.map((page, index) => (
          <React.Fragment key={index}>
            {page &&
              page?.results?.map((movie) => (
                <Card
                  key={movie.id}
                  item={movie as MediaType}
                  isTruncateOverview={false}
                  itemType={queryKey === QUERY_KEYS.MOVIES_KEY ? 'movie' : 'tv'}
                />
              ))}
          </React.Fragment>
        ))}
      <div ref={myRef} />
    </div>
  )
}
