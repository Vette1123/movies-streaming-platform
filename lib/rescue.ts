/**
 * "Everything you have saved lives in this browser and nowhere else."
 *
 * The single most useful true thing Reely can say to somebody who has never
 * signed in, and until now it never said it. A library kept in localStorage is
 * one cleared cache, one new phone or one private window away from gone —
 * people find that out afterwards, which is the worst possible time.
 *
 * So this is a warning first and a sign-in prompt second, and the order matters:
 * it earns the click by being useful, not by being a banner. Which is also why
 * it stays quiet until there is enough in the library to be worth losing.
 */

/** Below this, there is nothing at risk worth interrupting somebody about. */
export const RESCUE_MIN_ITEMS = 5

export interface RescueCounts {
  saved: number
  history: number
  finished: number
}

/** Everything the browser is holding, counted once. */
export const rescueTotal = (counts: RescueCounts): number =>
  counts.saved + counts.history + counts.finished

/**
 * Should the banner appear at all?
 *
 * Signed in — never: the library is already off this device, and saying
 * otherwise would be a lie. Dismissed — never again; somebody who said no to
 * this has answered the question.
 */
export function shouldOfferRescue(
  counts: RescueCounts,
  signedIn: boolean | undefined,
  dismissed: boolean
): boolean {
  if (signedIn === true || dismissed) return false
  return rescueTotal(counts) >= RESCUE_MIN_ITEMS
}

/**
 * What it says, counting only the stores that actually have something in them.
 *
 * "12 saved titles, 0 episodes" is the kind of sentence that makes a warning
 * read as a form letter. Every clause here is a number somebody can go and look
 * at.
 */
export function rescueLine(counts: RescueCounts): string {
  const parts: string[] = []
  if (counts.saved > 0) {
    parts.push(
      `${counts.saved} saved ${counts.saved === 1 ? 'title' : 'titles'}`
    )
  }
  if (counts.finished > 0) {
    parts.push(
      `${counts.finished} ${counts.finished === 1 ? 'episode or film' : 'episodes and films'} ticked off`
    )
  }
  if (counts.history > 0) {
    parts.push(
      `${counts.history} ${counts.history === 1 ? 'title' : 'titles'} in your history`
    )
  }

  if (parts.length === 0) return 'Nothing saved yet.'
  if (parts.length === 1) return `${parts[0]} — in this browser only.`
  const last = parts[parts.length - 1]
  return `${parts.slice(0, -1).join(', ')} and ${last} — in this browser only.`
}
