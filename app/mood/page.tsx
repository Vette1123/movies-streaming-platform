'use client'

import * as React from 'react'
import Link from 'next/link'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useInView } from 'react-intersection-observer'

import { MediaType } from '@/types/media'
import { discoverApi } from '@/lib/api-client'
import { Mood, moodById, MOODS, moodToFilters } from '@/lib/moods'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/card'
import { MediaGridSkeleton } from '@/components/loaders/media-grid-skeleton'
import { ListLoadError } from '@/components/media/list-load-error'

// The mood grid mirrors GenreMediaGrid's infinite pattern (same prefetch
// margin, same empty-page stop) but keyed per mood so switching moods keeps
// each cache warm.

function MoodResults({ mood }: { mood: Mood }) {
  const [sentinelRef, inView] = useInView({ rootMargin: '0px 0px 900px 0px' })
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isError,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['mood', mood.id],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      discoverApi('movie', moodToFilters(mood), {
        page: pageParam,
      }),
    getNextPageParam: (lastPage, pages) =>
      !lastPage?.results?.length || pages.length >= 500
        ? undefined
        : pages.length + 1,
  })

  React.useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage && !isError) {
      const t = setTimeout(() => fetchNextPage(), 100)
      return () => clearTimeout(t)
    }
  }, [inView, hasNextPage, isFetchingNextPage, isError, fetchNextPage])

  const items = (data?.pages ?? []).flatMap((page) => page?.results ?? [])

  if (isError && items.length === 0) {
    return <ListLoadError isEmpty={false} onRetry={() => refetch()} />
  }
  if (items.length === 0) return <MediaGridSkeleton count={12} />

  return (
    <>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
        {items.map((item) => (
          <Card key={item.id} item={item} />
        ))}
      </div>
      <div ref={sentinelRef} className="h-1" />
    </>
  )
}

export default function MoodPage() {
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const mood = moodById(activeId)

  return (
    <section className="container min-h-svh py-20 lg:py-32">
      <h1 className="text-2xl font-bold lg:text-3xl">
        What are you in the mood for?
      </h1>
      <p className="text-muted-foreground mt-2 max-w-xl text-sm">
        Skip the scrolling. Pick the feeling, get a stack tuned for it — every
        pick is rated 6.5+ by people who watched it.
      </p>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {MOODS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            data-testid={`mood-${entry.id}`}
            onClick={() => setActiveId(entry.id === activeId ? null : entry.id)}
            aria-pressed={entry.id === activeId}
            className={cn(
              'rounded-xl border p-4 text-left transition',
              entry.id === activeId
                ? 'border-primary bg-primary/10'
                : 'hover:border-foreground/30'
            )}
          >
            <span className="text-2xl">{entry.emoji}</span>
            <span className="mt-1 block font-semibold">{entry.label}</span>
            <span className="text-muted-foreground block text-xs">
              {entry.blurb}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-10">
        {mood ? (
          <MoodResults mood={mood} />
        ) : (
          <div className="border-border/60 text-muted-foreground rounded-xl border border-dashed p-10 text-center text-sm">
            Tap a mood above — the stack appears here.
            <div className="mt-4">
              <Link href="/reels" className={buttonVariants({ size: 'sm' })}>
                Or swipe trailers in Reels
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
