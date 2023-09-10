'use client'

import React from 'react'
import { useInView } from 'react-intersection-observer'

import { PopularMediaAction } from '@/types/movie-result'
import { MediaType, SeriesResponse } from '@/types/series-result'
import { useSeriesInfiniteScroll } from '@/hooks/use-series-infinite-scroll'
import { Card } from '@/components/card'

interface MediaContentProps {
  media: SeriesResponse
  getPopularMediaAction: PopularMediaAction<SeriesResponse>
}

export const SeriesContent = ({
  media,
  getPopularMediaAction,
}: MediaContentProps) => {
  const [myRef, inView] = useInView()
  const { data, fetchNextPage } = useSeriesInfiniteScroll({
    media,
    popularMediaAction: getPopularMediaAction,
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
                />
              ))}
          </React.Fragment>
        ))}
      <div ref={myRef} />
    </div>
  )
}
