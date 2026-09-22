'use client'

import React, { useMemo, useState } from 'react'
import { Dices } from 'lucide-react'

import { convertMinutesToHours } from '@/lib/utils'
import {
  daySeed,
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

  return (
    <section className="mb-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold sm:text-xl">
            Tonight&apos;s triple
          </h2>
          <p className="text-sm text-muted-foreground">
            Three from your watchlist — about{' '}
            <span className="tabular-nums">{convertMinutesToHours(total)}</span>
            .
          </p>
        </div>
        {/* Exactly three saved: every spin is the same three, reordered. */}
        {watchlist.length > 3 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSpins((n) => n + 1)}
            className="gap-2"
          >
            <Dices className="size-4" aria-hidden />
            Spin again
          </Button>
        ) : null}
      </div>
      {/* PosterTile, the shared grid tile: a missing poster gets the drawn
          fallback instead of an empty box, and the href comes from one place. */}
      <ul className="grid grid-cols-3 gap-3 sm:gap-4" aria-live="polite">
        {triple.map((item) => (
          <li key={`${item.type}:${item.id}`}>
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
              sizes="(min-width: 1400px) 27rem, 31vw"
            />
          </li>
        ))}
      </ul>
    </section>
  )
}
