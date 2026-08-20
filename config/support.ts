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

/**
 * Where a human answers.
 *
 * Printed wherever money is involved, and deliberately an address rather than a
 * form: a payment that did not switch anything on is a problem the person who
 * paid cannot debug, and one they will abandon rather than hunt for a contact
 * page. There is no ticket system behind it — it is one mailbox, read by the
 * person who wrote the code.
 *
 * Receiving is all this address does. It is Cloudflare Email Routing forwarding
 * to a real mailbox, and the domain still SENDS nothing: SPF ends `-all`, the
 * wildcard DKIM selector is a null policy and DMARC is `p=reject`, so nothing
 * can be forged as coming from `@reely.space`. All three govern sending only,
 * which is why inbound works and a reply has to leave from somewhere else.
 *
 * Do not "fix" that by loosening SPF, and re-run `pnpm dns:harden` after any
 * Email Routing change — the wizard resets the qualifier to `~all` behind you.
 * See lessons/2026-08-16-email-routing-support-address.md.
 */
export const SUPPORT_EMAIL = 'support@reely.space'

/** A pre-addressed mail, so nobody has to explain which site they mean. */
export const supportMailto = (subject: string): string =>
  `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`${SUPPORT_TAG} — ${subject}`)}`

/**
 * The prices as one sentence, and as one compact row.
 *
 * Written five times across the site before this existed — the support page,
 * the supporter gate, the account panel, the footer card and the terms page all
 * spelled the same three numbers out by hand, in two different formats. A price
 * change had to be found in five files or one of them would quietly advertise
 * the old number next to a checkout that charges the new one.
 *
 * Two shapes rather than one because two are genuinely needed: prose where
 * there is room for a sentence, and the compact row where there is not.
 */
export const supportPriceLine = (): string =>
  `$${SUPPORT_PRICES.monthly} a month, $${SUPPORT_PRICES.yearly} a year, or $${SUPPORT_PRICES.lifetime} once.`

export const supportPriceRow = (): string =>
  `$${SUPPORT_PRICES.monthly}/month · $${SUPPORT_PRICES.yearly}/year · $${SUPPORT_PRICES.lifetime} once`

/**
 * The yearly price said the way people actually compare prices.
 *
 * $50 against $5 is not a comparison anybody does in their head at a glance,
 * and the one that matters — it is cheaper per month — is invisible until
 * somebody divides. Two decimal places because $4.16 rounded to $4 would
 * advertise a price that does not exist.
 */
export const monthlyEquivalent = (yearly: number): string =>
  `$${(yearly / 12).toFixed(2)}`

export const yearlyAnchor = (): string =>
  `${monthlyEquivalent(SUPPORT_PRICES.yearly)} a month, paid once a year`
