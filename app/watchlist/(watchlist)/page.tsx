import React from 'react'
import { Metadata } from 'next'

import { WatchlistContainer } from '@/components/watchlist/watchlist-container'

export const metadata: Metadata = {
  title: 'Watchlist',
  description: 'Your saved movies and TV shows',
}

function WatchlistPage() {
  return (
    <section className="container h-full py-20 lg:py-36">
      <h1 className="mb-8 text-3xl font-bold">My Watchlist</h1>
      <WatchlistContainer />
    </section>
  )
}

export default WatchlistPage
