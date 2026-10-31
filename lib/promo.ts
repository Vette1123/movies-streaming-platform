// Data for the footer cross-promo strip. Every app shows on every page, and
// the order here is the order on screen.
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
