import React from 'react'
import { Metadata } from 'next'

import { siteConfig } from '@/config/site'
import { WatchHistoryContainer } from '@/components/watch-history/watch-history'

export const metadata: Metadata = {
  title: 'Watch History',
  description: `Your personal watch history on ${siteConfig.name}. Track what you've watched and pick up where you left off.`,
  alternates: {
    canonical: '/watch-history',
  },
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
    },
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
