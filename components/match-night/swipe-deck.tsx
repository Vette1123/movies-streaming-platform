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
import { Heart, Info, Search, Undo2, X } from 'lucide-react'

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

/** One shape for all three actions: a pill with an icon and a word. The tones
 * differ, the geometry does not. */
const ACTION_BASE =
  'inline-flex select-none items-center justify-center gap-2 rounded-full font-semibold transition active:scale-95'

const ACTION_TONE = {
  pass: 'h-13 border border-rose-400/40 bg-rose-500/10 px-5 text-sm text-rose-300 hover:border-rose-400/70 hover:bg-rose-500/20 sm:px-6 sm:text-base',
  info: 'text-muted-foreground hover:text-foreground h-13 border border-white/10 px-4 text-sm hover:border-white/25',
  like: 'h-13 bg-emerald-500 px-5 text-sm text-white shadow-lg shadow-emerald-500/25 hover:bg-emerald-400 sm:px-6 sm:text-base',
} as const

/** One pill for everything on the meta line under the deck. */
const META_CHIP =
  'inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 font-medium transition'
const META_CHIP_BUTTON = `${META_CHIP} hover:text-foreground hover:border-white/25 disabled:pointer-events-none disabled:opacity-40`

const Kbd = ({ children }: { children: React.ReactNode }) => (
  <kbd className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 font-sans text-[10px] leading-none">
    {children}
  </kbd>
)

interface SwipeDeckProps {
  cards: MatchCard[]
  onDecide: (card: MatchCard, liked: boolean) => void
  onUndo?: () => void
  canUndo?: boolean
  /** Jump to the deck search. It lives under the deck on a phone, which is
   * below the fold - without a way in from here you have to know it is there. */
  onFind?: () => void
  remaining: number
  emptyState: React.ReactNode
}

export function SwipeDeck({
  cards,
  onDecide,
  onUndo,
  canUndo,
  onFind,
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
      {/* Driven by HEIGHT, not width. The card, the three buttons and the meta
          line have to sit on one screen together: sizing a 2:3 card off the
          column width pushed the actions below the fold on a laptop, which is
          how the first pass shipped a deck whose buttons you had to scroll to.
          `min()` keeps it sane on a tall phone and a short laptop alike. */}
      <div className="relative aspect-2/3 h-[min(56svh,28rem)] max-w-full">
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

      {/* Labelled actions. The first pass shipped three bare circles, and on a
          poster you have never seen a red X and a green heart are still a
          guess - the middle one (details) read as decoration. Words cost one
          line and remove the guess. */}
      <div className="mt-6 flex w-full items-center justify-center gap-2.5 sm:gap-3">
        <button
          type="button"
          data-testid="match-pass"
          onClick={() => decide(false)}
          className={`${ACTION_BASE} ${ACTION_TONE.pass}`}
        >
          <X className="size-5" aria-hidden />
          Nope
        </button>

        <Link
          href={matchCardHref(top)}
          className={`${ACTION_BASE} ${ACTION_TONE.info}`}
        >
          <Info className="size-4" aria-hidden />
          Details
        </Link>

        <button
          type="button"
          data-testid="match-like"
          onClick={() => decide(true)}
          className={`${ACTION_BASE} ${ACTION_TONE.like}`}
        >
          <Heart className="size-5 fill-current" aria-hidden />
          Like
        </button>
      </div>

      <div className="text-muted-foreground mt-5 flex flex-wrap items-center justify-center gap-2 text-xs">
        <span className={`${META_CHIP} bg-white/5`}>{remaining} left</span>
        {onFind ? (
          <button
            type="button"
            onClick={onFind}
            className={`${META_CHIP_BUTTON} lg:hidden`}
          >
            <Search className="size-3" aria-hidden />
            Search a title
          </button>
        ) : null}
        <span className="hidden items-center gap-1.5 sm:inline-flex">
          <Kbd>←</Kbd>
          nope
          <Kbd>→</Kbd>
          like
        </span>
        {onUndo ? (
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            className={META_CHIP_BUTTON}
          >
            <Undo2 className="size-3" aria-hidden />
            Undo
          </button>
        ) : null}
        {/* Last, so it is the line that wraps: the gesture is worth teaching
            once, but it is not what you look at on the tenth card. */}
        <span className="basis-full text-center sm:hidden">
          Or drag the card either way
        </span>
      </div>
    </div>
  )
}
