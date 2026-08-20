import React from 'react'
import { Metadata } from 'next'

import { siteConfig } from '@/config/site'
import { RescueBanner } from '@/components/account/rescue-banner'
import { SupportPrompt } from '@/components/support/support-prompt'
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
    <section className="container h-full min-h-svh py-20 lg:py-36">
      <h1 className="mb-6 text-2xl font-bold lg:text-3xl">Watch History</h1>
      <RescueBanner />
      <WatchHistoryContainer />
      <SupportPrompt
        icon="stats"
        surface="watch_history"
        title="This history is worth keeping"
        cta="See what support unlocks"
        className="mt-12"
      >
        It lives in this browser, so clearing your data or picking up another
        device loses it. Supporters keep it on their account, on every device,
        and it becomes the year in review — hours watched, titles finished, the
        genres you keep coming back to.
      </SupportPrompt>
    </section>
  )
}

export default WatchHistory
