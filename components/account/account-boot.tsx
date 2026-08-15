'use client'

import { useEffect } from 'react'

import { applyAppearance } from '@/lib/appearance'
import { useAccount } from '@/hooks/use-account'
import { useLibrarySync } from '@/hooks/use-library-sync'

/**
 * The account's two site-wide effects, mounted once in the root layout.
 *
 * Renders nothing. Both halves are inert for a visitor who is not signed in and
 * supporting — no request, no listener, no timer — which is the common case and
 * the one the whole architecture is tuned for.
 *
 * - **Library sync.** It belongs here rather than on the account page because
 *   the changes worth syncing are made everywhere else: a save on a detail page,
 *   an episode ticked off mid-season.
 * - **Appearance.** The blocking script in <head> has already painted the
 *   cached accent; this reconciles it with what the server says once the
 *   session refresh lands, so a change made on another device arrives here.
 */
export function AccountBoot() {
  useLibrarySync()

  const { signedIn, pro, prefs } = useAccount()
  const accent = prefs.accent
  const density = prefs.density

  useEffect(() => {
    // Only once the session has actually settled. Applying `{}` while it is
    // still unknown would strip the attributes the boot script set and flash the
    // default palette at exactly the people who paid not to see it.
    if (signedIn !== true) return
    applyAppearance(pro ? accent : undefined, pro ? density : undefined)
  }, [accent, density, pro, signedIn])

  return null
}
