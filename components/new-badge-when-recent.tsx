import React from 'react'

import { isRecentlyReleased } from '@/lib/utils'
import { NewBadge } from '@/components/new-badge'

/**
 * When this build was made (next.config.mjs pins it; Next inlines it into the
 * prerendered HTML and the client bundle alike).
 *
 * ponytail: "new" is judged against the BUILD, not the visit, so a title can
 * keep its badge for up to one deploy interval (6h cron) past the window.
 * Upgrade path: a client effect that re-checks against Date.now() and only
 * ever REMOVES the badge, never adds one.
 */
const BUILD_TIME = Number(process.env.NEXT_PUBLIC_BUILD_TIME)

interface NewBadgeWhenRecentProps {
  /** Release / air date to test against the recency window. */
  date?: string
  /** Override the recency window (days). Defaults to isRecentlyReleased's default. */
  withinDays?: number
  className?: string
  label?: string
}

/**
 * The single way to render the "New" badge.
 *
 * Deciding it against `Date.now()` during render would disagree between the
 * prerendered HTML and hydration (React #418), which is why it used to be
 * gated on mount — and why the badge popped in only after the whole page had
 * hydrated, visibly late on a details page. A static export ships its HTML and
 * its JS from the same build, so judging against the build's own clock is
 * deterministic on both sides: the badge is in the server HTML, with no wait.
 *
 * DO NOT call isRecentlyReleased() inline in render to drive a badge anywhere
 * else. Always render <NewBadgeWhenRecent />.
 */
export const NewBadgeWhenRecent = ({
  date,
  withinDays,
  className,
  label,
}: NewBadgeWhenRecentProps) => {
  if (!isRecentlyReleased(date, withinDays, BUILD_TIME)) return null
  return <NewBadge className={className} label={label} />
}
