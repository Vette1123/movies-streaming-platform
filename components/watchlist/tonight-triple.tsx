'use client'

import React, { useMemo, useState } from 'react'
import { Dices } from 'lucide-react'

import { convertMinutesToHours, getThumbPosterURL } from '@/lib/utils'
import {
  daySeed,
  minutesFor,
  pickTriple,
  tripleMinutes,
} from '@/lib/watchlist-triple'
import { useMounted } from '@/hooks/use-mounted'
import { useWatchlist } from '@/hooks/use-watchlist'
import { Button } from '@/components/ui/button'
import { MediaLink } from '@/components/media/media-link'

/**
 * "Tonight's triple" — three titles from your own watchlist that fit an evening.
 *
 * Mount-gated like every other localStorage read: the server and first client
 * render agree on null, then the pick appears. The seed is the UTC day (plus
 * whatever the Spin control has added), so the default triple is stable while
 * you navigate and only changes when the day does — or when you ask it to.
 */
export const TonightTriple = () => {
  const { watchlist } = useWatchlist()
  const isMounted = useMounted()
  const [spins, setSpins] = useState(0)

  const seed = useMemo(
    () => (isMounted ? daySeed() + spins : 0),
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
            <span className="tabular-nums">
              {convertMinutesToHours(total)}
            </span>
            .
          </p>
        </div>
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
      </div>
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {triple.map((item) => (
          <MediaLink
            key={`${item.type}:${item.id}`}
            href={
              item.type === 'movie'
                ? `/movies/${item.id}`
                : `/tv-shows/${item.id}`
            }
            className="group block"
          >
            <div className="overflow-hidden rounded-lg ring-1 ring-transparent transition-shadow group-hover:ring-primary/60">
              <img
                src={getThumbPosterURL(item.poster_path)}
                alt=""
                width={300}
                height={450}
                loading="lazy"
                className="aspect-2/3 w-full object-cover"
              />
            </div>
            <p className="mt-2 truncate text-sm font-medium">{item.title}</p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {convertMinutesToHours(minutesFor(item))}
            </p>
          </MediaLink>
        ))}
      </div>
    </section>
  )
}
