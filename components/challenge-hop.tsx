'use client'

import { installChallengeHop } from '@/lib/challenge-hop'

// Installed when this module evaluates, not in an effect: a child's effect runs
// before its parent's, so a page's first API call would otherwise beat it.
if (typeof window !== 'undefined') installChallengeHop()

export function ChallengeHop() {
  return null
}
