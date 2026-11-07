/**
 * The sponsor slot's catalogue: one card per page, for everyone but supporters.
 * It sits under the hero on the homepage and on every film and episode page,
 * and above the footer on almost every other page (`pagePlacement` in
 * lib/offers.ts names the few it stays off).
 *
 * Same mechanism as the social downloader's PromoSlot (an OFFERS list, a
 * weight, a subid on affiliate links, `rel="sponsored"`), plus two things a
 * paid booking needs: a date window, so a booked month ends on its own, and a
 * coupon printed on the card.
 *
 * - A paid sponsor gets `weight: 10` and a `from`/`until` window. It outranks
 *   everything, so while it is live it is the only card anybody sees.
 * - Our own apps fill the slot the rest of the time (`ownApp`). For now that
 *   is Masareef every day (`weight: 2`); Rafiq (`weight: 1`) is the fallback.
 *   Equal weights would take turns, one per day.
 * - `weight: 0` benches an entry. An href starting `TEMPLATE_` can never be
 *   live (tests/offers.test.ts).
 * - Supporters never see the slot at all.
 *
 * Selling it: /advertise, and `pnpm sponsor:stats` for the numbers.
 */
import { installLink } from '@/lib/apps'

/** Where the card sits; also the `subid` suffix a sponsor's dashboard sees. */
export const PLACEMENTS = ['home', 'details', 'page'] as const
export type OfferPlacement = (typeof PLACEMENTS)[number]

export interface Offer {
  /** React key, analytics id, and the `subid` the sponsor's network sees. */
  id: string
  /** Who the card is for; printed small on the card. */
  sponsor: string
  headline: string
  body: string
  cta: string
  /** Destination, with the sponsor's own referral id already in it. */
  href: string
  /** 0 benches the offer; the highest live weight wins the slot. */
  weight: number
  placements: readonly OfferPlacement[]
  /** Local /public path, rendered 48x48. */
  image?: string
  /** Printed on the card with a copy button. */
  coupon?: { code: string; saving: string }
  /** First and last day the booking runs, YYYY-MM-DD, inclusive (UTC). */
  from?: string
  until?: string
  /** Our own app: clean URL, no `sponsored`, labelled "From Reely's maker". */
  ownApp?: boolean
}

export const OFFERS: readonly Offer[] = [
  {
    id: 'masareef',
    sponsor: 'Masareef',
    headline: 'Know where your money went',
    body: 'An offline-first, multi-currency spending tracker, from the person who builds Reely.',
    cta: 'Get Masareef',
    href: installLink('masareef', 'reely-sponsor'),
    weight: 2,
    placements: PLACEMENTS,
    image: '/promo/masareef.png',
    ownApp: true,
  },
  {
    id: 'rafiq',
    sponsor: 'Rafiq',
    headline: 'Keep your day close to prayer',
    body: "A private Islamic companion with prayer times, Qur'an, adhkar and qibla, from the person who builds Reely.",
    cta: 'Get Rafiq',
    href: installLink('rafiq', 'reely', 'sponsor'),
    weight: 1,
    placements: PLACEMENTS,
    image: '/promo/rafiq.png',
    ownApp: true,
  },
  // A booked sponsor, as it would be filled in. Copy it, set the real href
  // (their referral link), the coupon and the month, and raise the weight.
  {
    id: 'example-sponsor',
    sponsor: 'Example',
    headline: 'One line on what they do for a viewer',
    body: 'A sentence a viewer would actually want to read under a film.',
    cta: 'See the offer',
    href: 'TEMPLATE_https://example.com/?ref=reely',
    weight: 0,
    placements: PLACEMENTS,
    coupon: { code: 'REELY', saving: '10% off' },
    from: '2026-12-01',
    until: '2026-12-31',
  },
]
