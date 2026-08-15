'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'

import {
  accountServerSnapshot,
  accountSnapshot,
  cachedProfile,
  hasAccountHint,
  markSignedOut,
  refreshAccount,
  subscribeAccount,
  type AccountState,
  type CachedProfile,
} from '@/lib/account'

/**
 * Read the account store. Does NOT fetch — see `useAccountSession` below.
 *
 * Split in two on purpose. Most consumers (the header control, a supporter
 * badge, a locked panel) only want to know what is already known; making the
 * read itself trigger a request would put a Worker invocation behind every
 * component that happens to care.
 */
export function useAccount(): AccountState {
  return useSyncExternalStore(
    subscribeAccount,
    accountSnapshot,
    accountServerSnapshot
  )
}

/**
 * The same state, but responsible for making it true.
 *
 * Exactly one mounted component per page should use this — the account page, or
 * whatever else genuinely needs live server state. Everything else uses
 * `useAccount`.
 *
 * A visitor with no hint cookie is settled as signed out with no request at all,
 * which is the common case on a site where most people never sign in.
 */
export function useAccountSession(): AccountState {
  const account = useAccount()

  useEffect(() => {
    if (!hasAccountHint()) {
      markSignedOut()
      return
    }
    void refreshAccount()

    // A sign-in that happened in another tab, or a session that expired while
    // this tab sat in the background, both show up as a stale control here. The
    // check on becoming visible is free when nothing changed: the token in hand
    // is still fresh, so `refreshAccount` returns without a request.
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      if (!hasAccountHint()) {
        markSignedOut()
        return
      }
      void refreshAccount()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  return account
}

export interface AccountIdentity {
  /**
   * False until the browser has had a chance to answer. Every consumer renders
   * a fixed-size placeholder while it is false, so nothing shifts when the real
   * answer arrives.
   */
  ready: boolean
  signedIn: boolean
  name: string | null
  email: string | null
  picture: string | null
  pro: boolean
}

const UNREADY: AccountIdentity = {
  ready: false,
  signedIn: false,
  name: null,
  email: null,
  picture: null,
  pro: false,
}

const identityOf = (
  account: AccountState,
  cached: CachedProfile | null
): AccountIdentity => ({
  ready: true,
  // Live state wins as soon as it exists; the cache covers the moment before it
  // arrives, which is what stops the header flashing "sign in" at a signed-in
  // visitor on every navigation.
  signedIn: account.signedIn ?? Boolean(cached),
  name: account.name ?? cached?.name ?? null,
  email: account.email ?? cached?.email ?? null,
  picture: account.picture ?? cached?.picture ?? null,
  pro: account.pro || cached?.pro === true,
})

/**
 * Who is signed in, for anything that paints them: the header control, the
 * mobile drawer, a supporter mark.
 *
 * Read-only by design — it never fetches. Exactly one component per page owns
 * the refresh (`useAccountSession`, mounted in the header), and everything else
 * shares its answer, so adding another place that shows the visitor's name costs
 * zero extra requests.
 */
export function useAccountIdentity(): AccountIdentity {
  const account = useAccount()
  // Read in an effect, not during render: localStorage is browser-only state and
  // the prerendered HTML has no answer for it.
  const [cached, setCached] = useState<CachedProfile | null>(null)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    // localStorage is external state with no server answer, so the first client
    // pass is the earliest anything can read it. Same shape as use-mounted.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCached(cachedProfile())

    setHydrated(true)
  }, [])

  if (!hydrated) return UNREADY
  if (account.signedIn === undefined && !cached) return UNREADY
  return identityOf(account, cached)
}
