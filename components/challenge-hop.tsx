'use client'

import { trackFeatureUsed } from '@/lib/analytics'
import { installChallengeHop, type PassOutcome } from '@/lib/challenge-hop'

const outcomeOf = (o: PassOutcome) => {
  if (o.how === 'dismissed') return 'denied'
  return o.ok ? 'ok' : 'failed'
}

// Installed when this module evaluates, not in an effect: a child's effect runs
// before its parent's, so a page's first API call would otherwise beat it.
if (typeof window !== 'undefined')
  installChallengeHop((o) =>
    trackFeatureUsed({
      feature: 'security_check',
      action: o.how,
      outcome: outcomeOf(o),
      ms: o.ms,
    })
  )

export function ChallengeHop() {
  return null
}
