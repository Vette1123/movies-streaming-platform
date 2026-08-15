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
 * The one-time purchase. Sold as a second membership level billed once, which is
 * what the provider calls a one-time level, and which fires the same
 * `membership.started` event; if it is ever moved to the Extras shelf,
 * `extra_purchase.created` is already subscribed and already matched by name.
 */
export const SUPPORT_LIFETIME = `${SUPPORT_TAG} — Lifetime`

/**
 * What each one costs, in whole dollars, so the site and the dashboard cannot
 * disagree about the price of the thing the site is linking to.
 *
 * The rule the numbers encode: a lifetime is a MULTIPLE of the yearly, never a
 * discount on it. Priced under the annual it kills the annual outright and pays
 * for itself inside a year — a permanent grant sold for less than one year of
 * the thing it replaces.
 */
export const SUPPORT_PRICES = { monthly: 5, yearly: 50, lifetime: 99 } as const

/** Where the two offers live. One page; the levels are cards on it. */
export const SUPPORT_URL = 'https://buymeacoffee.com/vetteotp/membership'
