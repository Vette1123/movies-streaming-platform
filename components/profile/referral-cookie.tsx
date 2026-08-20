'use client'

import { useEffect } from 'react'

import { REFERRAL_COOKIE } from '@/lib/auth/cookies'

/** A month is long enough to read a page, think about it, and come back. */
const MAX_AGE = 30 * 24 * 60 * 60

/**
 * Remember whose page sent this visitor here.
 *
 * Written on the profile itself rather than carried as a `?ref=` through the
 * sign-in: somebody reads a stranger's list of films, wanders the site for ten
 * minutes and signs in from the header, by which point the parameter on the
 * page they landed on is long gone. The auth callback reads this exactly once,
 * when an account is created.
 *
 * Not a credential and not personal: it holds a public handle, the worst a
 * forged one does is credit the wrong supporter with a sign-up, and it is
 * `SameSite=Lax` so it never rides on a cross-site request.
 */
export function ReferralCookie({ handle }: { handle: string }) {
  useEffect(() => {
    try {
      document.cookie = `${REFERRAL_COOKIE}=${encodeURIComponent(handle)}; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax`
    } catch {
      // Cookies blocked. The page works; nobody gets the credit.
    }
  }, [handle])

  return null
}
