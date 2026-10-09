'use client'

import { useEffect } from 'react'

import { REFERRAL_COOKIE } from '@/lib/auth/cookies'
import { INVITE_PARAM, parseInviteCode } from '@/lib/invite'

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
    rememberReferrer(handle)
  }, [handle])

  return null
}

function rememberReferrer(value: string): void {
  try {
    document.cookie = `${REFERRAL_COOKIE}=${encodeURIComponent(value)}; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax`
  } catch {
    // Cookies blocked. The page works; nobody gets the credit.
  }
}

/**
 * The same memory, for an invite link: `/?invite=<code>` on any page.
 *
 * Mounted once in the root layout. The parameter is dropped from the address
 * bar after it is read, so the person who was invited does not pass the
 * inviter's code on when they share a title.
 */
export function InviteCapture() {
  useEffect(() => {
    const url = new URL(window.location.href)
    const code = parseInviteCode(url.searchParams.get(INVITE_PARAM))
    if (!code) return
    rememberReferrer(code)
    url.searchParams.delete(INVITE_PARAM)
    window.history.replaceState(window.history.state, '', url)
  }, [])

  return null
}
