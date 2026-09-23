import { Metadata } from 'next'

import { siteConfig } from '@/config/site'
import { CompareView } from '@/components/profile/compare-view'

export const metadata: Metadata = {
  title: 'Taste match',
  description: `Put two ${siteConfig.name} profiles side by side and see where your rated-highest titles overlap. No sign-up, just two public handles.`,
  alternates: { canonical: '/compare' },
  // Without its own, a sent compare link unfurled as the homepage — and
  // sending the link is the whole point of this page.
  openGraph: {
    title: 'Taste match',
    description:
      'Two Reely profiles, side by side: what you both rated highest.',
    url: `${siteConfig.websiteURL}/compare`,
    type: 'website',
  },
}

/**
 * The compare is a tool, not a document: both handles ride the query string so
 * a result is a link, and every fetch happens in the browser against the
 * profile endpoint the shell already uses. The static export prerenders the
 * form; the empty state is what a crawler and a first-time visitor both get.
 */
export default function ComparePage() {
  return (
    <section className="container min-h-svh max-w-5xl py-20 lg:py-28">
      <div className="mb-10 max-w-[62ch] space-y-3">
        <h1 className="text-3xl font-bold tracking-tight lg:text-4xl">
          Taste match
        </h1>
        <p className="leading-relaxed text-muted-foreground">
          Two public profiles, and the eight titles each person rated highest.
          We line them up and show what is in both, what is only on one side,
          and the overlap as a percentage.
        </p>
      </div>
      <CompareView />
    </section>
  )
}
