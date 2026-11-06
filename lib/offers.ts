import type { Offer, OfferPlacement } from '@/config/offers'

const DAY_MS = 86_400_000

/** Today as the catalogue writes dates: YYYY-MM-DD, UTC. */
export const todayUtc = (): string => new Date().toISOString().slice(0, 10)

/** Inside its booking window. ISO dates compare correctly as strings. */
export function isLive(offer: Offer, today: string): boolean {
  if (offer.from && today < offer.from) return false
  if (offer.until && today > offer.until) return false
  return true
}

/**
 * The one card for a placement on a given day.
 *
 * The highest live weight wins outright, so a paid booking (weight 10) is
 * exclusive for its window. Ties take turns one per day, in catalogue order,
 * so every visitor sees the same card on the same day and each own app gets
 * an even share.
 */
export function selectOffer(
  offers: readonly Offer[],
  placement: OfferPlacement,
  today: string
): Offer | null {
  const live = offers.filter(
    (o) => o.weight > 0 && o.placements.includes(placement) && isLive(o, today)
  )
  if (live.length === 0) return null
  const top = Math.max(...live.map((o) => o.weight))
  const tied = live.filter((o) => o.weight === top)
  const day = Math.floor(Date.parse(`${today}T00:00:00Z`) / DAY_MS)
  return tied[day % tied.length]
}

/**
 * The link as clicked. An affiliate link carries `subid=reely_<placement>` so
 * the sponsor's dashboard splits Reely's orders from their other partners';
 * the fragment is kept last. Our own apps already carry their `?s=` tag.
 */
export function offerHref(offer: Offer, placement: OfferPlacement): string {
  if (offer.ownApp) return offer.href
  const [base, fragment] = offer.href.split('#', 2)
  const joiner = base.includes('?') ? '&' : '?'
  const tagged = `${base}${joiner}subid=reely_${placement}`
  return fragment === undefined ? tagged : `${tagged}#${fragment}`
}

/** Paid links are `sponsored nofollow`, as search engines require. */
export const offerRel = (offer: Offer): string =>
  offer.ownApp
    ? 'noopener noreferrer'
    : 'sponsored nofollow noopener noreferrer'
