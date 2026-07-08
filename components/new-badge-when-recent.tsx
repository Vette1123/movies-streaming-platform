'use client'

import React from 'react'

import { isRecentlyReleased } from '@/lib/utils'
import { useMounted } from '@/hooks/use-mounted'
import { NewBadge } from '@/components/new-badge'

interface NewBadgeWhenRecentProps {
  /** Release / air date to test against the recency window. */
  date?: string
  /** Override the recency window (days). Defaults to isRecentlyReleased's default. */
  withinDays?: number
  className?: string
  label?: string
}

/**
 * The single hydration-safe way to render the "New" badge.
 *
 * isRecentlyReleased() reads Date.now(), so deciding badge presence during
 * render is non-deterministic between the server-baked HTML (frozen at
 * prerender/revalidate time) and client hydration: a title can cross the
 * recency window in between — or stale ISR HTML from an older deploy can
 * disagree with fresh client JS — flipping the badge and tripping a hydration
 * mismatch (React error #418).
 *
 * Gating on mount makes the server render and the first client render always
 * agree (nothing), then reveals the badge after hydration. This is why every
 * badge must go through this component.
 *
 * DO NOT call isRecentlyReleased() inline in render to drive a badge anywhere
 * else — that reintroduces #418. Always render <NewBadgeWhenRecent /> instead.
 */
export const NewBadgeWhenRecent = ({
  date,
  withinDays,
  className,
  label,
}: NewBadgeWhenRecentProps) => {
  const isMounted = useMounted()
  if (!isMounted || !isRecentlyReleased(date, withinDays)) return null
  return <NewBadge className={className} label={label} />
}
