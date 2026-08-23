'use client'

import * as React from 'react'
import Link from 'next/link'
import { PartyPopper, Users } from 'lucide-react'

import type { MatchHit } from '@/lib/api-client'
import { cardKey, matchCardHref, type MatchCard } from '@/lib/match-night'
import { getThumbPosterURL } from '@/lib/utils'

// What the room has agreed on. A match can only exist because YOU liked the
// title too, so the artwork for one is always already on this device - that is
// why the panel can show posters without a single extra request, and why it
// resolves them from the likes this browser recorded rather than asking the
// Worker for details it would have to fetch from TMDB.

function Presence({ swipers }: { swipers: number }) {
  const label = (() => {
    if (swipers <= 1) return 'Waiting for someone to join'
    return `${swipers} people swiping`
  })()
  return (
    <p className="text-muted-foreground flex items-center gap-2 text-xs">
      <Users className="size-3.5" aria-hidden />
      {label}
      {swipers <= 1 ? (
        <span
          aria-hidden
          className="size-1.5 animate-pulse rounded-full bg-amber-400"
        />
      ) : null}
    </p>
  )
}

export function MatchPanel({
  hits,
  swipers,
  cardsByKey,
}: {
  hits: MatchHit[]
  swipers: number
  cardsByKey: Record<string, MatchCard>
}) {
  const matched = React.useMemo(
    () =>
      hits
        .map(
          (hit) =>
            cardsByKey[cardKey({ id: hit.media_id, mediaType: hit.media_type })]
        )
        .filter((card): card is MatchCard => Boolean(card)),
    [hits, cardsByKey]
  )

  return (
    <div data-testid="match-panel">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold">
          Matches
          {matched.length > 0 ? (
            <span className="ml-2 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-bold text-emerald-400">
              {matched.length}
            </span>
          ) : null}
        </h2>
        <Presence swipers={swipers} />
      </div>

      {matched.length === 0 ? (
        <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
          Nothing agreed on yet. A title lands here the moment two of you like
          it.
        </p>
      ) : (
        <ul data-testid="match-hit" className="mt-3 space-y-1">
          {matched.map((card) => (
            <li key={`${card.mediaType}-${card.id}`}>
              <Link
                href={matchCardHref(card)}
                className="hover:bg-muted/60 flex items-center gap-3 rounded-lg p-1.5 transition"
              >
                {card.poster ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={getThumbPosterURL(card.poster)}
                    alt=""
                    loading="lazy"
                    className="h-14 w-10 shrink-0 rounded-sm object-cover ring-1 ring-emerald-400/40"
                  />
                ) : null}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {card.title}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-emerald-400">
                    <PartyPopper className="size-3" aria-hidden />
                    You both said yes
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
