// Data for the footer cross-promo strip. The footer has one slot, so the app
// shown is a pure function of the route: the server and the client agree, and
// each page keeps the same app on every visit.
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

/** Stable pick per route (djb2 hash), so both apps rotate across the site. */
export function pickPromo(pathname: string): Promo {
  let hash = 5381
  for (let i = 0; i < pathname.length; i++) {
    hash = (hash * 33 + pathname.charCodeAt(i)) >>> 0
  }
  return PROMOS[hash % PROMOS.length]
}
