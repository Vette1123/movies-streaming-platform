import type { Offer, OfferPlacement } from '@/config/offers'
import { routeTemplate } from '@/lib/analytics-context'

const DAY_MS = 86_400_000

/** Today as the catalogue writes dates: YYYY-MM-DD, UTC. */
export const todayUtc = (): string => new Date().toISOString().slice(0, 10)

/** Inside its booking window. ISO dates compare correctly as strings. */
export function isLive(offer: Offer, today: string): boolean {
  if (offer.from && today < offer.from) return false
  if (offer.until && today > offer.until) return false
  return true
}

/** No date yet: only an offer with no booking window can be live. */
const isEvergreen = (offer: Offer): boolean => !offer.from && !offer.until

/**
 * The one card for a placement on a given day.
 *
 * The highest live weight wins outright, so a paid booking (weight 10) is
 * exclusive for its window. Ties take turns one per day, in catalogue order,
 * so every visitor sees the same card on the same day and each own app gets
 * an even share.
 *
 * `today: null` is the static HTML and the hydration pass: built on one day,
 * hydrated on another, so it may only pick what no date can change (the
 * evergreen offers, first of a tie). The client re-picks with the real date
 * straight after.
 */
export function selectOffer(
  offers: readonly Offer[],
  placement: OfferPlacement,
  today: string | null
): Offer | null {
  const live = offers.filter(
    (o) =>
      o.weight > 0 &&
      o.placements.includes(placement) &&
      (today === null ? isEvergreen(o) : isLive(o, today))
  )
  if (live.length === 0) return null
  const top = Math.max(...live.map((o) => o.weight))
  const tied = live.filter((o) => o.weight === top)
  if (today === null) return tied[0]
  const day = Math.floor(Date.parse(`${today}T00:00:00Z`) / DAY_MS)
  return tied[day % tied.length]
}

/**
 * Route templates that render their own slot higher up the page. A tail id is
 * served the media-fallback shell, and `usePathname()` reports the shell's own
 * route there (hooks/use-location-pathname.ts), so it is listed too.
 */
const OWN_SLOT = new Set([
  '/',
  '/movies/:id',
  '/tv-shows/:id',
  '/media-fallback',
])

/**
 * Pages the site-wide card stays off: legal text, account and sign-in, the
 * Pro page (it is selling the card's removal), and /advertise (it shows its
 * own preview). Matched on the first path segment.
 */
const NO_SLOT = new Set([
  'advertise',
  'support',
  'account',
  'link',
  'privacy',
  'terms',
  'disclaimer',
  'dmca',
])

/** Which placement the card above the footer takes on this path, if any. */
export function pagePlacement(pathname: string): OfferPlacement | null {
  const template = routeTemplate(pathname)
  if (OWN_SLOT.has(template)) return null
  if (NO_SLOT.has(template.split('/')[1])) return null
  return 'page'
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
