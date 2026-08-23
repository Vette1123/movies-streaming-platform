import { Metadata } from 'next'

import { siteConfig } from '@/config/site'

export const metadata: Metadata = {
  title: `What's your mood? | ${siteConfig.name}`,
  description:
    'Pick a mood — cozy, adrenaline, mind-bending, scare me — and get a hand-tuned stack of movies and shows that fit it right now.',
  alternates: { canonical: '/mood' },
  openGraph: {
    title: `What's your mood? | ${siteConfig.name}`,
    description: 'Pick a mood, get the stack that fits it.',
    url: `${siteConfig.websiteURL}/mood`,
    type: 'website',
  },
}

export default function MoodLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
