/**
 * The sponsor slot's catalogue: one card under the player once a title starts.
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

export type OfferPlacement = 'post-play'

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
    placements: ['post-play'],
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
    placements: ['post-play'],
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
    placements: ['post-play'],
    coupon: { code: 'REELY', saving: '10% off' },
    from: '2026-12-01',
    until: '2026-12-31',
  },
]
