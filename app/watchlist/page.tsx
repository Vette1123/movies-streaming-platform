import React from 'react'
import { Metadata } from 'next'

import { siteConfig } from '@/config/site'
import { SupportPrompt } from '@/components/support/support-prompt'
import { WatchlistContainer } from '@/components/watchlist/watchlist'

export const metadata: Metadata = {
  title: 'My Watchlist',
  description: `Your saved movies and TV shows on ${siteConfig.name}. Bookmark titles to watch later.`,
  alternates: {
    canonical: '/watchlist',
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

function Watchlist() {
  return (
    <section className="container h-full py-20 lg:py-36">
      <h1 className="mb-6 text-2xl font-bold lg:text-3xl">My Watchlist</h1>
      <WatchlistContainer />
      <SupportPrompt
        icon="sync"
        surface="watchlist"
        title="Take this watchlist with you"
        cta="See what support unlocks"
        className="mt-12"
      >
        Everything above is saved in this browser and nowhere else — a new
        phone, a cleared cache or a different laptop starts empty. Supporters
        keep one watchlist across every device they sign in on, and get a
        notification the day something on it airs.
      </SupportPrompt>
    </section>
  )
}

export default Watchlist
