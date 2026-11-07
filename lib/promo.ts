// Data for the footer cross-promo strip, in on-screen order. Every app shows
// on every page, except one the sponsor card right above is already showing.
export interface Promo {
  slug: string
  name: string
  headline: string
  body: string
  cta: string
  image: string
  size: number
}

export const PROMOS: Promo[] = [
  {
    slug: 'masareef',
    name: 'Masareef',
    headline: 'Know where your money went',
    body: 'Masareef is an offline-first, multi-currency spending tracker, from the people behind this site.',
    cta: 'Get Masareef',
    image: '/promo/masareef.png',
    size: 80,
  },
  {
    slug: 'rafiq',
    name: 'Rafiq',
    headline: 'Keep your day close to prayer',
    body: "Rafiq is a private Islamic companion with prayer times, Qur'an, adhkar and qibla, from the people behind this site.",
    cta: 'Get Rafiq',
    image: '/promo/rafiq.png',
    size: 96,
  },
]

/**
 * The strip beside a sponsor card. When the card right above it is one of our
 * own apps, that app is left out here rather than shown twice in a row; a paid
 * sponsor, or no card, leaves the strip whole.
 */
export function promosBeside(
  card: { id: string; ownApp?: boolean } | null
): Promo[] {
  if (!card?.ownApp) return PROMOS
  return PROMOS.filter((promo) => promo.slug !== card.id)
}
