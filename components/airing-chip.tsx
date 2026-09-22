'use client'

import React from 'react'

import { airingLabel } from '@/lib/airing'
import { useMounted } from '@/hooks/use-mounted'
import { Chip } from '@/components/ui/chip'

interface AiringChipProps {
  /** TMDB `next_episode_to_air.air_date` — a calendar date, or absent. */
  airDate?: string | null
  className?: string
}

/**
 * "Airs today" / "Airs tomorrow" / … chip for an upcoming episode.
 *
 * Mount-gated for the same reason as NewBadgeWhenRecent: `airingLabel` reads
 * Date.now(), so deciding presence during render is non-deterministic between
 * the server-baked HTML and the client, and can trip React #418. Server and
 * first client render agree on nothing; the chip appears after hydration.
 *
 * The caller reserves the badge row (`min-h-7`) so this landing post-hydration
 * does not shove the title down.
 */
export const AiringChip = ({ airDate, className }: AiringChipProps) => {
  const isMounted = useMounted()
  const label = isMounted ? airingLabel(airDate) : null
  if (!label) return null
  return (
    <Chip variant={label.urgent ? 'primary' : 'neutral'} className={className}>
      {label.label}
    </Chip>
  )
}
