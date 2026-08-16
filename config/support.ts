/**
 * Which Buy Me a Coffee offers belong to *this* project, and what they cost.
 *
 * One account serves several projects, and every webhook endpoint on it receives
 * every event — endpoints subscribe to event types, not to levels. The only
 * per-purchase attribute the provider carries that we control is the NAME of the
 * thing bought, so each project tags its offers with its own short name and
 * recognises nothing else. That tag is the whole mechanism; there is no shared
 * database and no cross-project lookup.
 *
 * Written once, here. The webhook matches on it (lib/billing/bmc.ts) and the
 * support page prints it, and the failure this file exists to prevent is those
 * two drifting apart from each other or from the dashboard: a renamed offer
 * stops every grant, with one log line to say so and a supporter who paid to
 * notice it.
 */
export const SUPPORT_TAG = 'Reely'

/** The recurring level, on the Memberships shelf. $5 monthly or $50 yearly. */
export const SUPPORT_MEMBERSHIP = `${SUPPORT_TAG} — Supporter`

/**
 * The one-time purchase — and the one offer that is deliberately NOT tagged.
 *
 * Buy Me a Coffee allows exactly one lifetime level per account, not one per
 * project, so `Reely — Lifetime` cannot exist alongside another project's. The
 * choice that leaves is either no lifetime here at all, or one lifetime that
 * covers everything on the account. This is the second: the string below is
 * shared verbatim by every project's `config/support.ts`, every endpoint
 * recognises it, and $99 buys supporter status in all of them at once.
 *
 * That is the exact behaviour `SUPPORT_TAG` exists to prevent, allowed here on
 * purpose and only here. It is safe in the direction that matters — a *recurring*
 * membership still unlocks one project, so the cheap offer cannot leak across —
 * and the price is set for the whole shelf rather than for one site.
 *
 * Rename it in the dashboard and it stops granting everywhere at once, so the
 * string has to change in every project's config in the same sitting.
 */
export const SUPPORT_LIFETIME = 'Lifetime — everything I build'

/**
 * What each one costs, in whole dollars, so the site and the dashboard cannot
 * disagree about the price of the thing the site is linking to.
 *
 * The rule the numbers encode: a lifetime is a MULTIPLE of the yearly, never a
 * discount on it. Priced under the annual it kills the annual outright and pays
 * for itself inside a year — a permanent grant sold for less than one year of
 * the thing it replaces.
 *
 * The lifetime now buys every project rather than this one (see
 * `SUPPORT_LIFETIME`), which makes $99 a better deal than it was, not a worse
 * one — but it also means the number is set once for the whole account and
 * cannot be tuned per site.
 */
export const SUPPORT_PRICES = { monthly: 5, yearly: 50, lifetime: 99 } as const

/** Where the two offers live. One page; the levels are cards on it. */
export const SUPPORT_URL = 'https://buymeacoffee.com/vetteotp/membership'
