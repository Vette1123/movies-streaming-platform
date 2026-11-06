/**
 * How somebody gets Pro, and what it costs.
 *
 * The old payment provider suspended the account on 2026-11-06, so until a new
 * one is in place Pro is arranged by EMAIL: every buy button opens
 * a pre-addressed mail to `PRO_EMAIL`, the reply says how to pay, and the owner
 * switches Pro on by hand with `pnpm pro <address>` (scripts/grant-pro.mjs).
 * That writes the same `supporters` row every earlier supporter already has, so
 * nobody who paid before loses anything, and an address with no account yet is
 * claimed on its first sign-in (lib/billing/supporters.ts).
 */
export const SUPPORT_TAG = 'Reely'

/** Where a request for Pro goes. One constant; every buy button reads it. */
export const PRO_EMAIL = 'booogado@gmail.com'

/** The plans, as the subject line names them. */
export type ProPlan = 'Monthly' | 'Yearly' | 'Lifetime' | 'Any plan'

/**
 * A pre-filled mail asking for Pro: the plan in the subject, and the address to
 * switch on in the body, because Pro is granted to the sign-in email and a
 * request that does not name it costs a round trip.
 */
export function proMailto(plan: ProPlan, accountEmail: string | null): string {
  const subject = `${SUPPORT_TAG} Pro — ${plan}`
  const body = [
    `Hi, I would like Reely Pro (${plan}).`,
    '',
    `The email I sign in to Reely with: ${accountEmail ?? ''}`,
    '',
  ].join('\n')
  return `mailto:${PRO_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

/**
 * What each plan costs, in whole dollars. A lifetime is a MULTIPLE of the
 * yearly, never a discount on it: priced under the annual it kills the annual
 * and pays for itself inside a year.
 */
export const SUPPORT_PRICES = { monthly: 5, yearly: 50, lifetime: 99 } as const

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
