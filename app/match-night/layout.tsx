import { Metadata } from 'next'

import { siteConfig } from '@/config/site'
import { SITE_CARD } from '@/lib/og/share-image'
import { withSiteSocial } from '@/lib/page-metadata'

export const metadata: Metadata = withSiteSocial({
  title: 'Match Night: Pick a Movie Together',
  description:
    'Two people, one deck, one code. Swipe what you would watch tonight — when you both like the same title, it is a match and the movie-night decision is made.',
  alternates: { canonical: '/match-night' },
  openGraph: {
    images: SITE_CARD,
    title: 'Match Night',
    description: 'Swipe together, match on a title, stop arguing.',
    url: `${siteConfig.websiteURL}/match-night`,
    type: 'website',
  },
})

export default function MatchNightLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
