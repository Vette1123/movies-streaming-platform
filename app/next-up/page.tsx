import React from 'react'
import { Metadata } from 'next'

import { siteConfig } from '@/config/site'
import { NextUpPanel } from '@/components/account/next-up-panel'

export const metadata: Metadata = {
  title: 'Pick up where you left off',
  description: `Everything you have started on ${siteConfig.name}, and the exact spot you stopped — films and shows, one tap from playing.`,
  alternates: {
    canonical: '/next-up',
  },
  // Personal and per-visitor, like the watchlist page. A static shell either
  // way — there is nothing here a search engine should index.
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

/**
 * The queue as its own page.
 *
 * The homepage rail shows the newest handful; this is where "See all" lands.
 * It exists because the old target was the account console — a heavy,
 * session-gated detour that felt broken on a phone. One light route, the same
 * panel the console uses, nothing else.
 */
function NextUp() {
  return (
    <section className="container h-full min-h-svh py-20 lg:py-36">
      <h1 className="mb-2 text-2xl font-bold lg:text-3xl">
        Pick up where you left off
      </h1>
      <p className="text-muted-foreground mb-8 max-w-[60ch] text-sm leading-relaxed">
        Every film and show you have going, the exact spot you stopped, newest
        first. Play something anywhere and it moves to the front — here and on
        your home row.
      </p>
      <NextUpPanel />
    </section>
  )
}

export default NextUp
