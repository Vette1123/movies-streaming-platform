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

/**
 * The whole decision, as a function of three facts. Separated from the toast
 * because "does this person get asked for money, ever" is the part worth being
 * certain about, and certainty here means a test rather than three saved titles
 * and a screenshot. See tests/support-nudge.test.ts.
 *
 * `=== SAVES_BEFORE_ASKING`, not `>=`: past the threshold the flag has already
 * been claimed, and an equality check means a cleared flag (a wiped browser)
 * cannot re-ask somebody with a 40-title watchlist on their next save.
 */
export function shouldNudge({
  savedCount,
  pro,
  alreadyNudged,
}: {
  savedCount: number
  pro: boolean
  alreadyNudged: boolean
}): boolean {
  if (savedCount !== SAVES_BEFORE_ASKING) return false
  if (pro) return false
  return !alreadyNudged
}

export function maybeNudgeSupport(savedCount: number): void {
  if (typeof window === 'undefined') return

  let alreadyNudged = true
  try {
    alreadyNudged = Boolean(window.localStorage.getItem(NUDGED_KEY))
  } catch {
    // Private mode, or storage denied — there is nowhere to remember having
    // asked, so never ask rather than ask on every save.
    return
  }

  // `pro` from the cached profile: the synchronous half of the account store,
  // the same thing the header paints from, so this costs no request. Somebody
  // who already pays must never be sold to.
  if (
    !shouldNudge({
      savedCount,
      pro: cachedProfile()?.pro === true,
      alreadyNudged,
    })
  )
    return

  try {
    // Written BEFORE the toast, so a second save in the same session cannot
    // race its way to a second ask.
    window.localStorage.setItem(NUDGED_KEY, '1')
  } catch {
    return
  }

  trackSupportNudgeShown({ trigger: 'watchlist_third_save' })
  // After the save confirmation, not underneath it. The save fires its own toast
  // in the same tick, and sonner stacks: measured, the ask landed behind
  // "Saved 'The Dark Knight' to your watchlist" and was effectively invisible.
  window.setTimeout(showNudge, 1600)
}

function showNudge(): void {
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
