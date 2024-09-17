import React from 'react'
import { Metadata } from 'next'

import { siteConfig } from '@/config/site'
import { WatchHistoryContainer } from '@/components/watch-history/watch-history'

export const metadata: Metadata = {
  title: 'Watch History',
  description: 'Watch History',
  metadataBase: new URL('/watch-history', process.env.NEXT_PUBLIC_BASE_URL),
  openGraph: {
    images: [siteConfig.personalLogo, siteConfig.links.twitter],
  },
}

function WatchHistory() {
  return (
    <section className="container h-full py-20 lg:py-36">
      <WatchHistoryContainer />
    </section>
  )
}

export default WatchHistory
