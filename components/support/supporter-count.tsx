'use client'

import { useQuery } from '@tanstack/react-query'
import { Users } from 'lucide-react'

import { getJson } from '@/lib/api-client'
import { SUPPORTER_FLOOR } from '@/lib/community/routes'

/**
 * How many people are actually paying for this.
 *
 * The strongest line on a support page is the one that says other people
 * already decided. It is read live rather than typed into the copy, because a
 * number somebody wrote down once is a number that is wrong by next week — and
 * this one is a claim about strangers' money.
 *
 * Renders nothing at all below the floor. A true "6 supporters" reads as a dead
 * site and argues against itself; saying nothing is the honest version of not
 * having a number worth showing yet.
 */
export function SupporterCount() {
  const { data } = useQuery<{ supporters: number }>({
    queryKey: ['community', 'supporters'],
    staleTime: 10 * 60 * 1000,
    retry: false,
    queryFn: () => getJson<{ supporters: number }>('/api/community'),
  })

  const count = data?.supporters ?? 0
  if (count < SUPPORTER_FLOOR) return null

  return (
    <p className="text-muted-foreground flex items-center gap-2 text-sm">
      <Users className="size-4" />
      <span>
        <span className="text-foreground font-semibold tabular-nums">
          {count}
        </span>{' '}
        people already keep Reely free for everyone else.
      </span>
    </p>
  )
}
