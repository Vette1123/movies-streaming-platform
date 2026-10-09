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
 * Two thresholds, one ask. A third saved title was the only trigger, and it
 * reached two people in 38 days: 13 of ~1,500 visitors ever saved anything,
 * while 437 pressed play an average of five times. So the third PLAY earns the
 * ask too, whichever comes first, and the flag still means it happens once.
 */
const NUDGED_KEY = 'reely_support_nudged'
/** Armed by the third play, shown the next time no player is on screen. */
const ARMED_KEY = 'reely_support_nudge_armed'
const PLAYS_KEY = 'reely_play_count'
const SAVES_BEFORE_ASKING = 3
const PLAYS_BEFORE_ASKING = 3

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

/**
 * Whether this play arms the ask. Same shape and the same `===` reasoning as
 * shouldNudge: the counter only ever passes 3 once.
 */
export function shouldArmOnPlay({
  playCount,
  pro,
  alreadyNudged,
}: {
  playCount: number
  pro: boolean
  alreadyNudged: boolean
}): boolean {
  if (playCount !== PLAYS_BEFORE_ASKING) return false
  if (pro) return false
  return !alreadyNudged
}

/**
 * Whether an armed ask may speak now. Never over a playing title: a toast on
 * top of somebody's film is the obnoxious version of this, so it waits for
 * the next page without a player on it.
 */
export function shouldShowArmed({
  armed,
  alreadyNudged,
  pro,
  playerOpen,
}: {
  armed: boolean
  alreadyNudged: boolean
  pro: boolean
  playerOpen: boolean
}): boolean {
  return armed && !alreadyNudged && !pro && !playerOpen
}

const isPro = (): boolean => cachedProfile()?.pro === true

const read = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

/** Claims the one ask. False when storage is denied: then never ask at all. */
const claim = (): boolean => {
  try {
    // Written BEFORE the toast, so a second trigger in the same session cannot
    // race its way to a second ask.
    window.localStorage.setItem(NUDGED_KEY, '1')
    window.localStorage.removeItem(ARMED_KEY)
    return true
  } catch {
    return false
  }
}

export function maybeNudgeSupport(savedCount: number): void {
  if (typeof window === 'undefined') return
  // Private mode, or storage denied — there is nowhere to remember having
  // asked, so never ask rather than ask on every save.
  const flag = read(NUDGED_KEY)
  if (
    !shouldNudge({
      savedCount,
      // From the cached profile, the same thing the header paints from: this
      // costs no request, and somebody who already pays must never be sold to.
      pro: isPro(),
      alreadyNudged: Boolean(flag),
    })
  )
    return
  if (!claim()) return

  trackSupportNudgeShown({ trigger: 'watchlist_third_save' })
  // After the save confirmation, not underneath it. The save fires its own toast
  // in the same tick, and sonner stacks: measured, the ask landed behind
  // "Saved 'The Dark Knight' to your watchlist" and was effectively invisible.
  window.setTimeout(() => showNudge('watchlist'), 1600)
}

/**
 * Count a play, and arm the ask on the third. Called next to every
 * `trackMediaPlayed`, so the count is plays rather than page views.
 */
export function notePlayForSupportNudge(): void {
  if (typeof window === 'undefined') return
  let count = 0
  try {
    count = (Number(window.localStorage.getItem(PLAYS_KEY)) || 0) + 1
    window.localStorage.setItem(PLAYS_KEY, String(count))
  } catch {
    return
  }
  if (
    shouldArmOnPlay({
      playCount: count,
      pro: isPro(),
      alreadyNudged: Boolean(read(NUDGED_KEY)),
    })
  ) {
    try {
      window.localStorage.setItem(ARMED_KEY, '1')
    } catch {
      // Not armed is the safe failure.
    }
  }
}

/**
 * Speak, if a play armed the ask and nothing is playing now. Called by
 * components/support/support-nudge-host.tsx on every page and whenever a
 * player closes.
 */
export function showArmedSupportNudge(): void {
  if (typeof window === 'undefined') return
  if (
    !shouldShowArmed({
      armed: read(ARMED_KEY) === '1',
      alreadyNudged: Boolean(read(NUDGED_KEY)),
      pro: isPro(),
      playerOpen: document.body.dataset.playerOpen === '1',
    })
  )
    return
  if (!claim()) return
  trackSupportNudgeShown({ trigger: 'third_play' })
  showNudge('plays')
}

const NUDGE_COPY = {
  watchlist: {
    title: 'Your watchlist lives in this browser',
    description: `Supporters keep it on every device, with an alert the day something on it airs. From $${SUPPORT_PRICES.monthly} a month.`,
  },
  plays: {
    title: 'Three titles in. Reely is free, and stays that way.',
    description: `Supporters keep it running, and start every title on the Reely Player: faster, with subtitles and resume. From $${SUPPORT_PRICES.monthly} a month.`,
  },
} as const

function showNudge(kind: keyof typeof NUDGE_COPY): void {
  toast(NUDGE_COPY[kind].title, {
    description: NUDGE_COPY[kind].description,
    duration: 12000,
    action: {
      label: 'See more',
      // A full navigation rather than the router: this fires from a hook that
      // has no router in scope, on a static site where either costs the same.
      onClick: () => {
        trackSupportCtaClicked({ surface: 'nudge' })
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = '/support'
      },
    },
  })
}
