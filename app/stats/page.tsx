import { Metadata } from 'next'

import { siteConfig } from '@/config/site'
import { StatsPanel } from '@/components/account/stats-panel'

export const metadata: Metadata = {
  title: 'Your year in Reely',
  description: `Hours watched, titles finished and the streaks behind them, from your own ${siteConfig.name} library.`,
  alternates: { canonical: '/stats' },
  // Nothing here is the same for two people, and none of it is on the server at
  // render time. An indexed copy would be an empty page.
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
}

export default function StatsPage() {
  return (
    <section className="container max-w-4xl min-h-svh py-20 lg:py-28">
      <div className="mb-10 space-y-2">
        <h1 className="text-3xl font-bold tracking-tight lg:text-4xl">
          Your year in Reely
        </h1>
        <p className="text-muted-foreground max-w-[60ch] leading-relaxed">
          Counted from what you have ticked off yourself. Nothing here was
          recorded without you.
        </p>
      </div>
      <StatsPanel />
    </section>
  )
}
