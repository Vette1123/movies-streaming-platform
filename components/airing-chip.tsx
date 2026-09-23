'use client'

import React from 'react'

import {
  airingLabel,
  episodeCode,
  withEpisode,
  type NextEpisode,
} from '@/lib/airing'
import { useMounted } from '@/hooks/use-mounted'
import { Chip } from '@/components/ui/chip'

interface AiringChipProps {
  /** TMDB `next_episode_to_air`: its air date drives the chip, its numbers
   * name the episode ("S2 E5 airs tomorrow"). Absent for most titles. */
  episode?: NextEpisode | null
  className?: string
}

/**
 * "S2 E5 airs today" / "Airs tomorrow" / … chip for an upcoming episode.
 *
 * Mount-gated for the same reason as NewBadgeWhenRecent: `airingLabel` reads
 * Date.now(), so deciding presence during render is non-deterministic between
 * the server-baked HTML and the client, and can trip React #418. Server and
 * first client render agree on nothing; the chip appears after hydration.
 *
 * The caller reserves the badge row (`min-h-7`) so this landing post-hydration
 * does not shove the title down.
 */
export const AiringChip = ({ episode, className }: AiringChipProps) => {
  const isMounted = useMounted()
  const label = isMounted ? airingLabel(episode?.air_date) : null
  if (!label) return null
  return (
    <Chip variant={label.urgent ? 'primary' : 'neutral'} className={className}>
      {withEpisode(label.label, episodeCode(episode))}
    </Chip>
  )
}
