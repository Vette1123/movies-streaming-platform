import { trackSignedIn, trackSupporterActivated } from '@/lib/analytics'

// The half of a purchase the site can see.
//
// Pro is switched on by hand after an email (config/support.ts), so the site
// never sees the payment itself. What it can see is the last account state this
// browser saw, which makes the moment somebody becomes signed in or a supporter
// countable at all.

const LAST_ACCOUNT_KEY = 'reely_last_account'

export interface AccountSeen {
  signedIn: boolean
  pro: boolean
}

/**
 * What changed between the last account state this browser saw and this one.
 *
 * Only real transitions count. A browser seen for the first time (`prev` null)
 * reports nothing, so the deploy that ships this does not fire "activated" for
 * every existing supporter's first page view.
 */
export function accountTransitions(
  prev: AccountSeen | null,
  next: AccountSeen
): { signedIn: boolean; activated: boolean } {
  if (!prev) return { signedIn: false, activated: false }
  return {
    signedIn: !prev.signedIn && next.signedIn,
    activated: !prev.pro && next.pro && next.signedIn,
  }
}

/** Called by AccountBoot each time the session settles. */
export function noteAccountState(next: AccountSeen): void {
  let prev: AccountSeen | null = null
  try {
    const raw = window.localStorage.getItem(LAST_ACCOUNT_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AccountSeen>
      prev = { signedIn: parsed.signedIn === true, pro: parsed.pro === true }
    }
    window.localStorage.setItem(LAST_ACCOUNT_KEY, JSON.stringify(next))
  } catch {
    return
  }
  const changed = accountTransitions(prev, next)
  if (changed.signedIn) trackSignedIn()
  if (changed.activated) {
    trackSupporterActivated({
      surface: 'email',
    })
  }
}
