'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type PanInfo,
} from 'framer-motion'
import { Heart, Info, Undo2, X } from 'lucide-react'

import { matchCardHref, type MatchCard } from '@/lib/match-night'
import { getPosterImageURL } from '@/lib/utils'

// The deck itself: a physical stack of posters you throw left or right.
//
// Three cards are mounted at a time. That is not decoration - the two behind
// the top card are how the NEXT posters get decoded before they are needed.
// The old single-card deck fetched a fresh image on every swipe, so the card
// went blank for as long as the network took, which is most of what "laggy"
// meant here. The other half was that the swipe waited on the POST before
// advancing; the parent now advances first and reports the swipe in the
// background, so a decision is never slower than a repaint.

/** Past this many pixels (or this much flick velocity) the card is gone. */
const COMMIT_DISTANCE = 110
const COMMIT_VELOCITY = 520

const STACK_DEPTH = 3

export type SwipeDirection = 1 | -1

/** Poster art at the size the card actually paints - w500 covers a 2x 288px
 * card. The page used to hand these the `original` (w-2560) builder, which is
 * roughly ten times the bytes for the same painted pixels. */
const posterSrc = (card: MatchCard): string | null =>
  card.poster ? getPosterImageURL(card.poster) : null

function CardArt({ card, priority }: { card: MatchCard; priority?: boolean }) {
  const src = posterSrc(card)
  if (!src) {
    return (
      <div className="text-muted-foreground grid h-full w-full place-items-center bg-zinc-900 p-6 text-center text-sm">
        {card.title}
      </div>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      draggable={false}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      className="pointer-events-none h-full w-full object-cover select-none"
    />
  )
}

function CardMeta({ card }: { card: MatchCard }) {
  return (
    <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black via-black/70 to-transparent px-5 pt-16 pb-5">
      <div className="flex items-center gap-2 text-[11px] font-semibold tracking-wide text-white/70">
        <span className="rounded-full bg-white/15 px-2 py-0.5 backdrop-blur">
          {card.mediaType === 'tv' ? 'Series' : 'Film'}
        </span>
        {card.year ? <span>{card.year}</span> : null}
        {card.rating > 0 ? (
          <span className="text-amber-300">{card.rating.toFixed(1)}</span>
        ) : null}
      </div>
      <p className="mt-1.5 text-lg leading-tight font-semibold text-balance text-white">
        {card.title}
      </p>
    </div>
  )
}

/**
 * The top card: draggable, rotates with the throw, and shows which way it is
 * about to go. Keyed by card id upstream so every new card mounts with a fresh
 * motion value at rest.
 */
function TopCard({
  card,
  exitDirection,
  onDecide,
}: {
  card: MatchCard
  exitDirection: SwipeDirection
  onDecide: (liked: boolean) => void
}) {
  const reduceMotion = useReducedMotion()
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-240, 240], [-13, 13])
  const likeOpacity = useTransform(x, [30, 130], [0, 1])
  const passOpacity = useTransform(x, [-130, -30], [1, 0])

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const thrown =
      Math.abs(info.offset.x) > COMMIT_DISTANCE ||
      Math.abs(info.velocity.x) > COMMIT_VELOCITY
    if (thrown) onDecide(info.offset.x > 0)
  }

  return (
    <motion.div
      data-testid="match-card"
      drag="x"
      dragSnapToOrigin
      dragElastic={0.55}
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={onDragEnd}
      style={{ x, rotate }}
      initial={reduceMotion ? false : { scale: 0.96, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={
        reduceMotion
          ? { opacity: 0 }
          : {
              x: exitDirection * 520,
              rotate: exitDirection * 18,
              opacity: 0,
              transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] },
            }
      }
      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      className="absolute inset-0 z-10 cursor-grab overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl active:cursor-grabbing"
    >
      <CardArt card={card} priority />
      <CardMeta card={card} />

      {/* Verdict stamps: the drag says which way, before you let go. */}
      <motion.span
        style={{ opacity: likeOpacity }}
        className="pointer-events-none absolute top-6 left-6 rounded-lg border-2 border-emerald-400 px-3 py-1 text-lg font-black tracking-wider text-emerald-400 uppercase"
      >
        Yes
      </motion.span>
      <motion.span
        style={{ opacity: passOpacity }}
        className="pointer-events-none absolute top-6 right-6 rounded-lg border-2 border-rose-400 px-3 py-1 text-lg font-black tracking-wider text-rose-400 uppercase"
      >
        Nope
      </motion.span>
    </motion.div>
  )
}

interface SwipeDeckProps {
  cards: MatchCard[]
  onDecide: (card: MatchCard, liked: boolean) => void
  onUndo?: () => void
  canUndo?: boolean
  remaining: number
  emptyState: React.ReactNode
}

export function SwipeDeck({
  cards,
  onDecide,
  onUndo,
  canUndo,
  remaining,
  emptyState,
}: SwipeDeckProps) {
  const [exitDirection, setExitDirection] = React.useState<SwipeDirection>(1)
  const top = cards[0]

  // One handler for the buttons and the keyboard both. It changes when the top
  // card does - once per swipe - which is the point: the old page declared its
  // key effect with no dependency array at all, so it tore down and re-attached
  // the listener on every render, including each tick of the four-second match
  // poll.
  const decide = React.useCallback(
    (liked: boolean) => {
      if (!top) return
      setExitDirection(liked ? 1 : -1)
      onDecide(top, liked)
    },
    [top, onDecide]
  )

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement
      // Arrow keys belong to the search field while it has focus.
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        return
      }
      if (e.key === 'ArrowRight') decide(true)
      if (e.key === 'ArrowLeft') decide(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [decide])

  if (!top) return <>{emptyState}</>

  const behind = cards.slice(1, STACK_DEPTH)

  return (
    <div className="flex w-full flex-col items-center">
      {/* Sized from the viewport HEIGHT, not the width: the deck plus its
          buttons has to fit on one screen without scrolling, and a 2:3 card
          driven by width blows past that on a short laptop. */}
      <div className="relative aspect-2/3 w-[min(20rem,41svh)] max-w-full">
        {/* The stack behind the top card. Static, non-interactive, and the
            reason the next poster is already decoded when it arrives. */}
        {behind.map((card, i) => (
          <div
            key={card.id}
            aria-hidden
            style={{
              transform: `translateY(${(i + 1) * 18}px) scale(${1 - (i + 1) * 0.04})`,
            }}
            className="absolute inset-0 z-0 overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 opacity-70 shadow-xl"
          >
            <CardArt card={card} />
          </div>
        ))}

        <AnimatePresence initial={false}>
          <TopCard
            key={top.id}
            card={top}
            exitDirection={exitDirection}
            onDecide={decide}
          />
        </AnimatePresence>
      </div>

      <div className="mt-6 flex items-center gap-5">
        <button
          type="button"
          aria-label="Pass"
          data-testid="match-pass"
          onClick={() => decide(false)}
          className="grid size-16 place-items-center rounded-full border border-white/10 bg-white/5 text-rose-400 transition hover:border-rose-400/50 hover:bg-rose-500/15 active:scale-95"
        >
          <X className="size-7" />
        </button>

        <Link
          href={matchCardHref(top)}
          aria-label={`Open ${top.title}`}
          className="text-muted-foreground hover:text-foreground grid size-11 place-items-center rounded-full border border-white/10 transition hover:border-white/25 active:scale-95"
        >
          <Info className="size-4" />
        </Link>

        <button
          type="button"
          aria-label="Like"
          data-testid="match-like"
          onClick={() => decide(true)}
          className="grid size-16 place-items-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400 active:scale-95"
        >
          <Heart className="size-7 fill-current" />
        </button>
      </div>

      <div className="text-muted-foreground mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs">
        <span>{remaining} left in the deck</span>
        <span aria-hidden>·</span>
        <span className="hidden sm:inline">Drag, or use the arrow keys</span>
        <span className="sm:hidden">Drag a card either way</span>
        {onUndo ? (
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            className="hover:text-foreground inline-flex items-center gap-1 underline underline-offset-4 disabled:pointer-events-none disabled:opacity-40"
          >
            <Undo2 className="size-3" />
            Undo
          </button>
        ) : null}
      </div>
    </div>
  )
}
