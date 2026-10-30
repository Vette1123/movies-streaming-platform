import { Metadata } from 'next'

import { siteConfig } from '@/config/site'
import { LinkDevice } from '@/components/account/link-device'

export const metadata: Metadata = {
  title: 'Link your TV',
  description: `Link Kodi on your TV to your ${siteConfig.name} account.`,
  alternates: { canonical: '/link' },
  robots: { index: false, follow: false },
}

export default function LinkPage() {
  return (
    // min-h-svh for the same reason as /account: the panel is client-only, and
    // reserving the viewport keeps the footer from being shoved down by it.
    <section className="container min-h-svh max-w-md py-20 lg:py-28">
      <LinkDevice />
    </section>
  )
}
