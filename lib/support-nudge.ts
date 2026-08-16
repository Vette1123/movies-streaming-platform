import { toast } from 'sonner'

import { SUPPORT_PRICES } from '@/config/support'
import { cachedProfile } from '@/lib/account'
import { trackSupportCtaClicked, trackSupportNudgeShown } from '@/lib/analytics'

/**
 * Ask once, after the app has earned it.
 *
 * The rule this file exists to enforce is that Reely asks for money exactly one
 * time unprompted, and only after somebody has used it enough for the ask to
 * make sense. Everything else on the site is a route to `/support` that waits to
 * be taken; this is the single thing that speaks first, so it gets a threshold,
 * a permanent flag, and no second chance.
 *
 * The threshold is a real one: a third saved title is somebody keeping a
 * watchlist, not somebody clicking a button to see what it does. And the pitch
 * is the true one for that moment — the list they have just built lives in this
 * browser and nowhere else.
 */
const NUDGED_KEY = 'reely_support_nudged'
const SAVES_BEFORE_ASKING = 3

/** Set the flag, and report whether this call is the one that got to. */
function claimTheOneAsk(): boolean {
  try {
    if (window.localStorage.getItem(NUDGED_KEY)) return false
    // Written BEFORE the toast, so a second save in the same session cannot
    // race its way to a second toast.
    window.localStorage.setItem(NUDGED_KEY, '1')
    return true
  } catch {
    // Private mode, or storage denied. Never ask rather than ask on every save.
    return false
  }
}

export function maybeNudgeSupport(savedCount: number): void {
  if (typeof window === 'undefined') return
  if (savedCount !== SAVES_BEFORE_ASKING) return
  // Someone who already pays must never be sold to. `cachedProfile` is the
  // synchronous half of the account store — the same thing the header paints
  // from — so this costs no request.
  if (cachedProfile()?.pro) return
  if (!claimTheOneAsk()) return

  trackSupportNudgeShown({ trigger: 'watchlist_third_save' })
  toast('Your watchlist lives in this browser', {
    description: `Supporters keep it on every device, with an alert the day something on it airs. From $${SUPPORT_PRICES.monthly} a month.`,
    duration: 12000,
    action: {
      label: 'See more',
      // A full navigation rather than the router: this fires from a hook that
      // has no router in scope, on a static site where either costs the same.
      onClick: () => {
        trackSupportCtaClicked({ surface: 'nudge' })
        window.location.href = '/support'
      },
    },
  })
}
