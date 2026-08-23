'use client'

import * as React from 'react'
import Link from 'next/link'
import { ReelItem } from '@/services/reels'
import { useInfiniteQuery } from '@tanstack/react-query'
import {
  Heart,
  Maximize2,
  Minimize2,
  Share2,
  Volume2,
  VolumeX,
} from 'lucide-react'

import { getReelsApi } from '@/lib/api-client'
import { QUERY_KEYS } from '@/lib/queryKeys'
import { getImageURL } from '@/lib/utils'
import { buildWatchedItem } from '@/hooks/use-local-storage'
import { useShare } from '@/hooks/use-share'
import { useWatchlist } from '@/hooks/use-watchlist'
import { buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

// Reely Reels — a full-screen, vertical trailer feed. Snap-scroll one title at
// a time; only the in-view slide mounts its YouTube iframe (autoplay + muted,
// the combination browsers allow), and scrolling past unmounts it again.

const BATCH_SIZE = 6

const mediaHref = (reel: ReelItem): string =>
  reel.mediaType === 'tv' ? `/tv-shows/${reel.id}` : `/movies/${reel.id}`

function ReelSlide({
  reel,
  active,
  focused,
  onToggleFocus,
}: {
  reel: ReelItem
  active: boolean
  focused: boolean
  onToggleFocus: () => void
}) {
  const [muted, setMuted] = React.useState(true)
  const frameRef = React.useRef<HTMLIFrameElement>(null)
  const { isSaved, toggle } = useWatchlist()
  const { share } = useShare()

  // The iframe mounts only while the slide is the active one, and the mute
  // state is pushed into it by re-setting src — YouTube's API is not worth a
  // second script for one toggle.
  const src = active
    ? `https://www.youtube-nocookie.com/embed/${reel.trailerKey}?autoplay=1&mute=${muted ? 1 : 0}&controls=0&loop=1&playlist=${reel.trailerKey}&modestbranding=1&playsinline=1&rel=0`
    : null

  const saved = isSaved(reel.id)
  // The watchlist toggle re-derives its stored shape via buildWatchedItem; the
  // reel already carries every field that derivation reads, so the cast is
  // only about the full-details types it declares.
  const toggleSave = () =>
    toggle(
      buildWatchedItem({
        id: reel.id,
        title: reel.mediaType === 'tv' ? undefined : reel.title,
        name: reel.mediaType === 'tv' ? reel.title : undefined,
        overview: reel.overview,
        backdrop_path: reel.backdrop,
        poster_path: reel.poster,
      }) as unknown as Parameters<typeof toggle>[0]
    )
  const shareReel = () => {
    void share({ title: reel.title, path: mediaHref(reel) })
  }

  return (
    <div
      data-testid="reel-slide"
      className="relative h-full w-full snap-start overflow-hidden"
    >
      {/* Backdrop stands in until (and if) the trailer plays */}
      {reel.backdrop ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={getImageURL(reel.backdrop)}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="absolute inset-0 bg-black" />
      )}

      {src ? (
        <iframe
          data-testid="reel-iframe"
          ref={frameRef}
          src={src}
          title={`${reel.title} trailer`}
          allow="autoplay; encrypted-media"
          className="reel-frame"
        />
      ) : null}

      {/* Legibility gradient */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black via-black/25 to-transparent" />

      {focused ? (
        <>
          {/* Focus mode: the trailer is the whole screen. One way in (Watch
              now), one way out (the button, or Escape). */}
          <button
            type="button"
            onClick={onToggleFocus}
            aria-label="Exit focus mode"
            className="absolute top-4 right-4 z-20 flex size-12 items-center justify-center rounded-full bg-white/10 backdrop-blur transition hover:bg-white/20"
          >
            <Minimize2 className="size-6 text-white" />
          </button>
          <Link
            href={mediaHref(reel)}
            data-testid="reel-watch-now"
            className="absolute bottom-10 left-1/2 z-20 -translate-x-1/2 rounded-full bg-emerald-600 px-8 py-3 font-semibold text-white shadow-lg transition hover:bg-emerald-500"
          >
            Watch now
          </Link>
        </>
      ) : (
        <>
          {/* Right action rail */}
          <div className="absolute right-3 bottom-28 z-10 flex flex-col items-center gap-4">
            <button
              type="button"
              onClick={toggleSave}
              data-testid="reel-save"
              aria-pressed={saved}
              aria-label={saved ? 'Remove from watchlist' : 'Add to watchlist'}
              className="flex size-12 flex-col items-center justify-center rounded-full bg-white/10 backdrop-blur transition hover:bg-white/20"
            >
              <Heart
                className={`size-6 ${saved ? 'fill-red-500 text-red-500' : 'text-white'}`}
              />
            </button>
            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              data-testid="reel-mute"
              aria-label={muted ? 'Unmute trailer' : 'Mute trailer'}
              className="flex size-12 items-center justify-center rounded-full bg-white/10 backdrop-blur transition hover:bg-white/20"
            >
              {muted ? (
                <VolumeX className="size-6 text-white" />
              ) : (
                <Volume2 className="size-6 text-white" />
              )}
            </button>
            <button
              type="button"
              onClick={shareReel}
              data-testid="reel-share"
              aria-label={`Share ${reel.title}`}
              className="flex size-12 items-center justify-center rounded-full bg-white/10 backdrop-blur transition hover:bg-white/20"
            >
              <Share2 className="size-6 text-white" />
            </button>
            <button
              type="button"
              onClick={onToggleFocus}
              data-testid="reel-focus"
              aria-label="Focus on this reel"
              className="flex size-12 items-center justify-center rounded-full bg-white/10 backdrop-blur transition hover:bg-white/20"
            >
              <Maximize2 className="size-6 text-white" />
            </button>
          </div>

          {/* Title block */}
          <div className="absolute right-16 bottom-24 left-4 z-10">
            <Link href={mediaHref(reel)} className="hover:underline">
              <h2 className="text-2xl font-bold text-white drop-shadow">
                {reel.title}{' '}
                {reel.year ? (
                  <span className="font-normal text-white/60">
                    ({reel.year})
                  </span>
                ) : null}
              </h2>
            </Link>
            <p className="mt-1 flex items-center gap-2 text-sm text-white/70">
              <span className="rounded bg-emerald-600/80 px-1.5 py-0.5 font-semibold text-white">
                ★ {reel.rating.toFixed(1)}
              </span>
              <span className="uppercase">
                {reel.mediaType === 'tv' ? 'Series' : 'Movie'}
              </span>
            </p>
            {reel.overview ? (
              <p className="mt-2 line-clamp-4 max-w-xl text-sm leading-relaxed text-white/80">
                {reel.overview}
              </p>
            ) : null}
            <div className="mt-3 flex gap-2">
              <Link
                href={mediaHref(reel)}
                className={buttonVariants({ size: 'sm' })}
              >
                Watch now
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default function ReelsPage() {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = React.useState(0)
  const [focusedIndex, setFocusedIndex] = React.useState<number | null>(null)

  // Escape leaves focus mode no matter which slide it was entered on.
  React.useEffect(() => {
    if (focusedIndex === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFocusedIndex(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focusedIndex])

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: [QUERY_KEYS.REELS_KEY],
      initialPageParam: 1,
      queryFn: ({ pageParam }) => getReelsApi(Number(pageParam)),
      getNextPageParam: (_, pages) => pages.length + 1,
    })

  const reels = React.useMemo(() => data?.pages.flat() ?? [], [data])

  // Which slide is in view (snap makes this binary), and prefetch the next
  // batch when the viewer nears the end of what is mounted.
  const onScroll = React.useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const index = Math.round(el.scrollTop / el.clientHeight)
    setActiveIndex(index)
    if (index >= reels.length - 3 && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage()
    }
  }, [reels.length, hasNextPage, isFetchingNextPage, fetchNextPage])

  return (
    <div
      className={`reels-viewport h-dvh overflow-hidden bg-black ${
        focusedIndex !== null ? 'reels-focus' : ''
      }`}
    >
      <div
        ref={containerRef}
        onScroll={onScroll}
        data-testid="reels-scroller"
        className="no-scrollbar h-full snap-y snap-mandatory overflow-y-scroll overscroll-contain"
      >
        {reels.length === 0 ? (
          <div className="flex h-full items-center justify-center gap-3">
            <Skeleton className="h-full w-full rounded-none" />
          </div>
        ) : (
          reels.map((reel, index) => (
            <div
              key={`${reel.mediaType}-${reel.id}`}
              className="h-full w-full snap-start"
            >
              <ReelSlide
                reel={reel}
                active={index === activeIndex}
                focused={focusedIndex === index}
                onToggleFocus={() =>
                  setFocusedIndex((cur) => (cur === index ? null : index))
                }
              />
            </div>
          ))
        )}
      </div>
    </div>
  )
}
