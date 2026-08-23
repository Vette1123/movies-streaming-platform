'use client'

import * as React from 'react'
import Link from 'next/link'
import { ReelItem } from '@/services/reels'
import { useInfiniteQuery } from '@tanstack/react-query'
import {
  ChevronUp,
  Heart,
  Maximize2,
  Minimize2,
  Play,
  RotateCw,
  Share2,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { useInView } from 'react-intersection-observer'

import { getReelsApi } from '@/lib/api-client'
import { QUERY_KEYS } from '@/lib/queryKeys'
import { getImageURL, getPosterImageURL } from '@/lib/utils'
import { buildWatchedItem } from '@/hooks/use-local-storage'
import { useShare } from '@/hooks/use-share'
import { useWatchlist } from '@/hooks/use-watchlist'
import { Button, buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

// Reely Reels - a full-screen, vertical trailer feed. Snap-scroll one title at
// a time; only the in-view slide mounts its YouTube iframe (autoplay + muted,
// the combination browsers allow), and scrolling past unmounts it again.
//
// Three things this file gets right that the first version did not:
//  - which slide is active comes from an IntersectionObserver, not from a
//    `scroll` handler calling setState on every frame. The handler re-rendered
//    the entire mounted feed on every scroll tick, which is what the stutter
//    was.
//  - mute is a postMessage to the player, not a new `src`. Re-writing the src
//    tore the iframe down and restarted the trailer from zero, so unmuting cost
//    you the part you had already watched.
//  - the still behind the trailer is the PORTRAIT poster at w500, not the
//    landscape backdrop at w-2560. The feed is portrait; the backdrop was both
//    the wrong shape and roughly ten times the bytes, and every mounted slide
//    was paying it.

const NEAR_SLIDES = 1
const PREFETCH_WITHIN = 3

const mediaHref = (reel: ReelItem): string =>
  reel.mediaType === 'tv' ? `/tv-shows/${reel.id}` : `/movies/${reel.id}`

/** The still frame. Portrait poster first, backdrop only when TMDB has no
 * poster for the title. */
const stillSrc = (reel: ReelItem): string | null => {
  if (reel.poster) return getPosterImageURL(reel.poster)
  if (reel.backdrop) return getImageURL(reel.backdrop)
  return null
}

const YOUTUBE_ORIGIN = 'https://www.youtube-nocookie.com'

const embedSrc = (key: string) =>
  `${YOUTUBE_ORIGIN}/embed/${key}?autoplay=1&mute=1&controls=0&loop=1&playlist=${key}&modestbranding=1&playsinline=1&rel=0&enablejsapi=1`

/**
 * YouTube's iframe API without loading YouTube's iframe API: the player accepts
 * the same JSON messages the script would send, which is how mute can be
 * changed without rewriting `src` and restarting the trailer.
 *
 * The handshake is not optional, and that is the part worth writing down.
 * Measured 2026-08-23: with `enablejsapi=1` alone the player sends nothing and
 * ignores every command. It starts talking only after the parent posts
 * `{event:'listening'}`, and then answers `onReady` and honours commands
 * (verified by reading back `info.muted === false` after `unMute`). Sending a
 * bare command and assuming it landed ships a mute button that does nothing.
 */
const PLAYER_ID = 1
const HANDSHAKE_MS = 300

const post = (frame: HTMLIFrameElement | null, message: object) => {
  frame?.contentWindow?.postMessage(
    JSON.stringify({ ...message, id: PLAYER_ID, channel: 'widget' }),
    YOUTUBE_ORIGIN
  )
}

const sendMute = (frame: HTMLIFrameElement | null, muted: boolean) =>
  post(frame, { event: 'command', func: muted ? 'mute' : 'unMute', args: [] })

/** Keeps the active slide's player in step with the feed-wide mute setting. */
function useYouTubeMute(
  frameRef: React.RefObject<HTMLIFrameElement | null>,
  active: boolean,
  muted: boolean
) {
  const mutedRef = React.useRef(muted)
  const readyRef = React.useRef(false)

  React.useEffect(() => {
    mutedRef.current = muted
  }, [muted])

  // Knock until the player answers, then apply whatever the setting is by then.
  React.useEffect(() => {
    const frame = frameRef.current
    readyRef.current = false
    if (!active || !frame) return

    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.contentWindow || readyRef.current) return
      readyRef.current = true
      clearInterval(timer)
      sendMute(frame, mutedRef.current)
    }
    window.addEventListener('message', onMessage)
    const knock = () => post(frame, { event: 'listening' })
    const timer = setInterval(knock, HANDSHAKE_MS)
    knock()

    return () => {
      window.removeEventListener('message', onMessage)
      clearInterval(timer)
    }
  }, [active, frameRef])

  // Later toggles go straight through, the player is already listening.
  React.useEffect(() => {
    if (active && readyRef.current) sendMute(frameRef.current, muted)
  }, [active, muted, frameRef])
}

// Every glass control in the feed is this button. It existed four times over
// with the same twelve classes copy-pasted between them.
function ActionButton({
  label,
  caption,
  pressed,
  testId,
  onClick,
  children,
}: {
  label: string
  /** The word under the glyph. A rail of unlabelled circles is a guessing
   * game; the caption is what turns it into a menu. */
  caption?: string
  pressed?: boolean
  testId?: string
  onClick: () => void
  children: React.ReactNode
}) {
  const button = (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      data-testid={testId}
      className="grid size-12 place-items-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20 active:scale-95"
    >
      {children}
    </button>
  )
  if (!caption) return button
  return (
    <span className="flex flex-col items-center gap-1">
      {button}
      <span
        aria-hidden
        className="text-[11px] leading-none font-medium text-white/70 drop-shadow"
      >
        {caption}
      </span>
    </span>
  )
}

function ReelSlide({
  reel,
  index,
  active,
  near,
  focused,
  muted,
  root,
  onActive,
  onToggleFocus,
  onToggleMute,
  showHint,
}: {
  reel: ReelItem
  index: number
  active: boolean
  near: boolean
  focused: boolean
  muted: boolean
  root: HTMLElement | null
  onActive: (index: number) => void
  onToggleFocus: () => void
  onToggleMute: () => void
  showHint: boolean
}) {
  const frameRef = React.useRef<HTMLIFrameElement>(null)
  const { isSaved, toggle } = useWatchlist()
  const { share } = useShare()

  // Which slide is in view. Snap makes this binary, so a single threshold is
  // enough and the observer fires once per slide change instead of per frame.
  const { ref } = useInView({
    root,
    threshold: 0.6,
    onChange: (inView) => {
      if (inView) onActive(index)
    },
  })

  useYouTubeMute(frameRef, active, muted)

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

  const still = stillSrc(reel)

  return (
    <div
      ref={ref}
      data-testid="reel-slide"
      className="relative h-full w-full snap-start overflow-hidden bg-black"
    >
      {/* The still stands in until the trailer paints, and only for slides the
          viewer can plausibly reach next. Everything further out holds black,
          which costs nothing to keep mounted. */}
      {near && still ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={still}
          alt=""
          loading={active ? 'eager' : 'lazy'}
          fetchPriority={active ? 'high' : 'low'}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : null}

      {active ? (
        <iframe
          data-testid="reel-iframe"
          ref={frameRef}
          src={embedSrc(reel.trailerKey)}
          title={`${reel.title} trailer`}
          allow="autoplay; encrypted-media"
          className="reel-frame"
        />
      ) : null}

      {/* Legibility gradient */}
      <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black via-black/25 to-transparent" />

      {focused ? (
        <>
          {/* Focus mode: the trailer is the whole screen. One way in (the
              expand button), one way out (this button, or Escape). */}
          <div className="absolute top-4 right-4 z-20 flex gap-2">
            <ActionButton label="Mute or unmute" onClick={onToggleMute}>
              {muted ? (
                <VolumeX className="size-5" />
              ) : (
                <Volume2 className="size-5" />
              )}
            </ActionButton>
            <ActionButton label="Exit focus mode" onClick={onToggleFocus}>
              <Minimize2 className="size-5" />
            </ActionButton>
          </div>
          <Link
            href={mediaHref(reel)}
            data-testid="reel-watch-now"
            className="absolute bottom-10 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full bg-emerald-500 px-8 py-3 font-semibold text-white shadow-lg transition hover:bg-emerald-400 active:scale-95"
          >
            <Play className="size-4 fill-current" aria-hidden />
            Watch now
          </Link>
        </>
      ) : (
        <>
          {/* Right action rail */}
          <div className="absolute right-3 bottom-28 z-10 flex flex-col items-center gap-3.5">
            <ActionButton
              label={saved ? 'Remove from watchlist' : 'Add to watchlist'}
              caption={saved ? 'Saved' : 'Save'}
              pressed={saved}
              testId="reel-save"
              onClick={toggleSave}
            >
              <Heart
                className={`size-6 ${saved ? 'fill-rose-500 text-rose-500' : ''}`}
              />
            </ActionButton>
            <ActionButton
              label={muted ? 'Unmute trailer' : 'Mute trailer'}
              caption={muted ? 'Sound' : 'Mute'}
              pressed={!muted}
              testId="reel-mute"
              onClick={onToggleMute}
            >
              {muted ? (
                <VolumeX className="size-6" />
              ) : (
                <Volume2 className="size-6" />
              )}
            </ActionButton>
            <ActionButton
              label={`Share ${reel.title}`}
              caption="Share"
              testId="reel-share"
              onClick={() =>
                void share({ title: reel.title, path: mediaHref(reel) })
              }
            >
              <Share2 className="size-6" />
            </ActionButton>
            <ActionButton
              label="Focus on this reel"
              caption="Expand"
              testId="reel-focus"
              onClick={onToggleFocus}
            >
              <Maximize2 className="size-6" />
            </ActionButton>
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
              {reel.rating > 0 ? (
                <span className="rounded bg-emerald-500/85 px-1.5 py-0.5 font-semibold text-white">
                  {reel.rating.toFixed(1)}
                </span>
              ) : null}
              <span className="uppercase">
                {reel.mediaType === 'tv' ? 'Series' : 'Movie'}
              </span>
            </p>
            {reel.overview ? (
              <p className="mt-2 line-clamp-3 max-w-xl text-sm leading-relaxed text-white/80">
                {reel.overview}
              </p>
            ) : null}
            <div className="mt-3">
              <Link
                href={mediaHref(reel)}
                className={buttonVariants({
                  size: 'sm',
                  className: 'gap-1.5 rounded-full',
                })}
              >
                <Play className="size-3.5 fill-current" aria-hidden />
                Watch now
              </Link>
            </div>
          </div>

          {/* First-run affordance only. The header and footer are hidden here,
              so nothing else on screen says the feed scrolls. */}
          {showHint ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-6 z-10 flex justify-center">
              <span className="flex animate-bounce items-center gap-1.5 rounded-full bg-black/50 px-3 py-1 text-xs text-white/80 backdrop-blur">
                <ChevronUp className="size-3.5" aria-hidden />
                Swipe for the next trailer
              </span>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

export default function ReelsPage() {
  const [root, setRoot] = React.useState<HTMLDivElement | null>(null)
  const [activeIndex, setActiveIndex] = React.useState(0)
  const [focusedIndex, setFocusedIndex] = React.useState<number | null>(null)
  // Mute is a feed-wide preference. Per-slide state meant every scroll silently
  // re-muted the trailer you had just turned the sound on for.
  const [muted, setMuted] = React.useState(true)

  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: [QUERY_KEYS.REELS_KEY],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => getReelsApi(Number(pageParam)),
    // A short page means trending has run out of titles carrying a trailer.
    // Returning a page number unconditionally kept the feed asking for pages
    // that could only ever come back empty.
    getNextPageParam: (last, pages) =>
      last.length >= 5 ? pages.length + 1 : undefined,
  })

  const reels = React.useMemo(() => data?.pages.flat() ?? [], [data])

  // Load the next batch while there are still slides in front of the viewer.
  React.useEffect(() => {
    if (!hasNextPage || isFetchingNextPage) return
    if (activeIndex >= reels.length - PREFETCH_WITHIN) void fetchNextPage()
  }, [
    activeIndex,
    reels.length,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  ])

  // Keyboard control: arrows page the feed, Escape leaves focus mode, M mutes.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFocusedIndex(null)
      if (e.key === 'm' || e.key === 'M') setMuted((m) => !m)
      const step = (() => {
        if (e.key === 'ArrowDown' || e.key === 'PageDown') return 1
        if (e.key === 'ArrowUp' || e.key === 'PageUp') return -1
        return 0
      })()
      if (!step || !root) return
      e.preventDefault()
      root.scrollBy({ top: step * root.clientHeight, behavior: 'smooth' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [root])

  const onActive = React.useCallback((index: number) => {
    setActiveIndex(index)
    setFocusedIndex((current) => (current === index ? current : null))
  }, [])

  if (error) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-black px-6 text-center">
        <p className="text-white/80">The trailer feed did not load.</p>
        <Button onClick={() => void refetch()} className="gap-2 rounded-full">
          <RotateCw className="size-4" aria-hidden />
          Try again
        </Button>
      </div>
    )
  }

  return (
    <div
      className={`reels-viewport h-dvh overflow-hidden bg-black ${
        focusedIndex !== null ? 'reels-focus' : ''
      }`}
    >
      <div
        ref={setRoot}
        data-testid="reels-scroller"
        className="no-scrollbar h-full snap-y snap-mandatory overflow-y-scroll overscroll-contain"
      >
        {reels.length === 0 ? (
          <div className="h-full w-full">
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
                index={index}
                root={root}
                active={index === activeIndex}
                near={Math.abs(index - activeIndex) <= NEAR_SLIDES}
                focused={focusedIndex === index}
                muted={muted}
                onActive={onActive}
                onToggleMute={() => setMuted((m) => !m)}
                onToggleFocus={() =>
                  setFocusedIndex((cur) => (cur === index ? null : index))
                }
                showHint={index === 0 && activeIndex === 0}
              />
            </div>
          ))
        )}
      </div>
    </div>
  )
}
