'use client'

import React, { useMemo, useState } from 'react'
import { Dices } from 'lucide-react'

import { convertMinutesToHours } from '@/lib/utils'
import {
  daySeed,
  EVENING_MINUTES,
  minutesFor,
  pickTriple,
  sittingLabel,
  tripleMinutes,
} from '@/lib/watchlist-triple'
import { useMounted } from '@/hooks/use-mounted'
import { useWatchlist } from '@/hooks/use-watchlist'
import { Button } from '@/components/ui/button'
import { PosterTile } from '@/components/media/poster-tile'

/** Spins per day before two days' seeds could meet — far past any real use. */
const SPINS_PER_DAY = 1000

/**
 * "Tonight's triple" — three titles from your own watchlist that fit an evening.
 *
 * Mount-gated like every other localStorage read: the server and first client
 * render agree on null, then the pick appears. The seed is the visitor's local
 * day (scaled, so tomorrow's default is not today's first spin) plus whatever
 * the Spin control has added: stable while you navigate, and only changes when
 * the day does — or when you ask it to.
 */
export const TonightTriple = () => {
  const { watchlist } = useWatchlist()
  const isMounted = useMounted()
  const [spins, setSpins] = useState(0)

  const seed = useMemo(
    () => (isMounted ? daySeed() * SPINS_PER_DAY + spins : 0),
    [isMounted, spins]
  )

  const triple = useMemo(
    () => (isMounted ? pickTriple(watchlist, seed) : []),
    [isMounted, watchlist, seed]
  )

  if (!isMounted || triple.length < 3) return null

  const total = tripleMinutes(triple)

  // A band, not a second grid: the triple is a suggestion sitting on top of
  // the watchlist, so its tiles sit a step below the list's own and the copy
  // sits beside them. As a full-width three-column grid it was ~400px tall
  // with the copy crammed above it, and pushed the list below the fold.
  return (
    <section
      aria-labelledby="tonight-triple-heading"
      className="mb-8 grid gap-5 rounded-xl border border-white/10 bg-white/3 p-4 sm:p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-8"
    >
      <div className="max-w-[46ch]">
        <h2
          id="tonight-triple-heading"
          className="text-lg font-semibold tracking-tight sm:text-xl"
        >
          Tonight&apos;s triple
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Three from your watchlist, about{' '}
          <span className="text-foreground tabular-nums">
            {convertMinutesToHours(total)}
          </span>
          {/* Only when nothing on the list fits the evening: say so rather
              than let "about 5 hours" pass as a normal night. */}
          {total > EVENING_MINUTES
            ? '. Nothing shorter fits tonight.'
            : ' in all.'}
        </p>
        {/* Exactly three saved: every spin is the same three, reordered. */}
        {watchlist.length > 3 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSpins((n) => n + 1)}
            className="group mt-4 gap-2"
          >
            <Dices
              className="size-4 transition-transform duration-300 group-active:rotate-90"
              aria-hidden
            />
            Spin again
          </Button>
        ) : null}
      </div>
      {/* Tiles keyed by the seed, so each spin replays the rise-in (the list
          itself stays mounted: a remounted live region announces nothing).
          The new pick arrives rather than silently swapping; the keyframes
          collapse to a fade under reduced motion (styles/globals.css).
          PosterTile is the shared grid tile: drawn fallback for a missing
          poster, one href. */}
      <ul
        className="grid grid-cols-3 gap-3 md:w-108 lg:w-136"
        aria-live="polite"
      >
        {triple.map((item, index) => (
          <li
            key={`${seed}:${item.type}:${item.id}`}
            className="animate-rise-in"
            style={{ animationDelay: `${index * 70}ms` }}
          >
            <PosterTile
              item={{
                id: item.id,
                type: item.type,
                title: item.title,
                poster_path: item.poster_path || null,
                note: sittingLabel(
                  item,
                  convertMinutesToHours(minutesFor(item))
                ),
              }}
              sizes="(min-width: 1024px) 11rem, (min-width: 768px) 8.5rem, 30vw"
            />
          </li>
        ))}
      </ul>
    </section>
  )
}
