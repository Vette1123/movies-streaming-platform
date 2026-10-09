import { Metadata } from 'next'

import { siteConfig } from '@/config/site'

export const metadata: Metadata = {
  title: 'Reels — trailer feed',
  description:
    'Swipe through trending trailers and start watching in one tap. A full-screen feed of new and popular movies and shows worth your next two hours, on Reely.',
  alternates: { canonical: '/reels' },
  openGraph: {
    title: 'Reels — trailer feed',
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
