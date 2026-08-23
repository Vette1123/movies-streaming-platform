import { Metadata } from 'next'

import { siteConfig } from '@/config/site'

export const metadata: Metadata = {
  title: `Reels — trailer feed | ${siteConfig.name}`,
  description:
    'Swipe through trending trailers and start watching in one tap. A full-screen feed of what is worth your next two hours.',
  alternates: { canonical: '/reels' },
  openGraph: {
    title: `Reels — trailer feed | ${siteConfig.name}`,
    description: 'Swipe through trending trailers. Watch in one tap.',
    url: `${siteConfig.websiteURL}/reels`,
    type: 'website',
  },
}

export default function ReelsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
