'use client'

import { useCountUp } from '@/lib/use-count-up'

/**
 * Counts a score up from 0 when it mounts, so the rating lands with a small
 * pop instead of appearing fully-formed. Reduced motion snaps it at once.
 *
 * The one client island in the ratings strip: the strip itself stays a server
 * component so the real score is in the prerendered HTML for a crawler (the
 * hook starts at null, which renders `score` verbatim).
 */
export function CountUpNumber({ score }: { score: string }) {
  const target = Number(score)
  const value = useCountUp(isNaN(target) ? null : target)
  const show = value === null ? score : value.toFixed(decimalsOf(score))
  return <span>{show}</span>
}

/** "8.4" → 1, "67" → 0: a Metacritic 67 must not land as "67.0". */
export function decimalsOf(score: string): number {
  return score.split('.')[1]?.length ?? 0
}
