import { Metadata } from 'next'

import { siteConfig } from '@/config/site'

export const metadata: Metadata = {
  title: `Match Night | ${siteConfig.name}`,
  description:
    'Two people, one deck, one code. Swipe what you would watch tonight — when you both like the same title, it is a match and the decision is made.',
  alternates: { canonical: '/match-night' },
  openGraph: {
    title: `Match Night | ${siteConfig.name}`,
    description: 'Swipe together, match on a title, stop arguing.',
    url: `${siteConfig.websiteURL}/match-night`,
    type: 'website',
  },
}

export default function MatchNightLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
