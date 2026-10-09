import { trackSignedIn, trackSupporterActivated } from '@/lib/analytics'

// The half of a purchase the site can see.
//
// Payment happens on Buy Me a Coffee, in another tab, and lands through the
// webhook; the person who just paid comes back to a Reely tab that has no idea
// anything happened. Two small pieces of state close that gap: a "checkout
// started" mark, so /support knows to watch for the money, and the last
// account state this browser saw, so the moment somebody becomes signed in or
// a supporter is countable at all (nothing past /support was measured before).

const PENDING_KEY = 'reely_checkout_pending'
const LAST_ACCOUNT_KEY = 'reely_last_account'

/** Long enough to pay and come back; short enough not to haunt the next visit. */
export const PENDING_WINDOW_MS = 2 * 60 * 60 * 1000

export function markCheckoutPending(now = Date.now()): void {
  try {
    window.localStorage.setItem(PENDING_KEY, String(now))
  } catch {
    // Without the mark the page simply does not watch; paying still works.
  }
}

export function clearCheckoutPending(): void {
  try {
    window.localStorage.removeItem(PENDING_KEY)
  } catch {
    // Nothing to clear.
  }
}

/** When the pending checkout started, or null if none is live. */
export function checkoutPendingSince(now = Date.now()): number | null {
  try {
    const at = Number(window.localStorage.getItem(PENDING_KEY))
    if (!at) return null
    return isPendingLive(at, now) ? at : null
  } catch {
    return null
  }
}

export function isPendingLive(at: number, now: number): boolean {
  const age = now - at
  return age >= 0 && age < PENDING_WINDOW_MS
}

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
      surface: checkoutPendingSince() ? 'checkout' : 'elsewhere',
    })
  }
}
