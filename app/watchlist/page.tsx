import React from 'react'
import { Metadata } from 'next'

import { siteConfig } from '@/config/site'
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
    </section>
  )
}

export default Watchlist
