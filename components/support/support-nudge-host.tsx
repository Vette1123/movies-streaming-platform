'use client'

import * as React from 'react'
import { usePathname } from 'next/navigation'

import { onIdleAfterLoad } from '@/lib/idle'
import { showArmedSupportNudge } from '@/lib/support-nudge'

/**
 * Where the play-armed support ask gets to speak (lib/support-nudge.ts).
 *
 * The third play ARMS it; this shows it at the next calm moment - a page with
 * no player on it, or the moment a player closes - instead of over the start
 * of somebody's film. Renders nothing.
 */
export function SupportNudgeHost() {
  const pathname = usePathname()

  React.useEffect(() => {
    // After load and idle: an ask is the least important thing on any page.
    return onIdleAfterLoad(showArmedSupportNudge, 4000)
  }, [pathname])

  React.useEffect(() => {
    // The detail hero marks the body while it plays (components/details-hero
    // .tsx). Clearing that mark is "the film was closed".
    const observer = new MutationObserver(() => {
      if (document.body.dataset.playerOpen !== '1') showArmedSupportNudge()
    })
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['data-player-open'],
    })
    return () => observer.disconnect()
  }, [])

  return null
}
