import { Metadata } from 'next'

import { siteConfig } from '@/config/site'
import { CommunityDirectory } from '@/components/community/community-directory'

export const metadata: Metadata = {
  title: 'Lists and people on Reely',
  description: `Film and TV lists published by people who keep their library on ${siteConfig.name}, and the public pages behind them.`,
  alternates: { canonical: '/lists' },
}

/**
 * The public directory.
 *
 * This page is a static asset like every other, but `/lists` is in the Worker's
 * `run_worker_first` list, so the Worker answers it and decorates this exported
 * HTML with the real list of links before it goes out (handleListsDirectory in
 * cloudflare/worker.js). That is what makes an index of rows written after the
 * build crawlable — the client fetch below is for the person reading it.
 */
export default function ListsDirectoryPage() {
  return (
    <section className="container max-w-6xl min-h-svh py-20 lg:py-28">
      <div className="mb-12 max-w-[68ch] space-y-3">
        <h1 className="text-3xl font-bold tracking-tight lg:text-4xl">
          Lists and people on Reely
        </h1>
        <p className="text-muted-foreground leading-relaxed">
          Shelves other people made public: a horror marathon somebody actually
          ran, the films one person keeps going back to, what a stranger rated
          highest this year. Everything here is somebody&rsquo;s own library,
          published on purpose.
        </p>
      </div>
      <CommunityDirectory />
    </section>
  )
}
