import { Metadata } from 'next'

import { siteConfig } from '@/config/site'
import { SITE_CARD } from '@/lib/og/share-image'
import { withSiteSocial } from '@/lib/page-metadata'

export const metadata: Metadata = withSiteSocial({
  title: 'Reels — trailer feed',
  description:
    'Swipe through trending trailers and start watching in one tap. A full-screen feed of new and popular movies and shows worth your next two hours, on Reely.',
  alternates: { canonical: '/reels' },
  openGraph: {
    images: SITE_CARD,
    title: 'Reels — trailer feed',
    description: 'Swipe through trending trailers. Watch in one tap.',
    url: `${siteConfig.websiteURL}/reels`,
    type: 'website',
  },
})

export default function ReelsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
