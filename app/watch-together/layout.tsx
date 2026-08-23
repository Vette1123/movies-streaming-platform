import { Metadata } from 'next'

import { siteConfig } from '@/config/site'

export const metadata: Metadata = {
  title: `Watch Together (beta) | ${siteConfig.name}`,
  description:
    'Start a title, share a code, and everyone stays on the same second — play, pause and seeks follow the host automatically.',
  alternates: { canonical: '/watch-together' },
  openGraph: {
    title: `Watch Together (beta) | ${siteConfig.name}`,
    description: 'One code, same second, wherever everyone is.',
    url: `${siteConfig.websiteURL}/watch-together`,
    type: 'website',
  },
}

export default function WatchTogetherLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
