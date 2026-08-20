import { Metadata } from 'next'

import { siteConfig } from '@/config/site'
import { AccountPanel } from '@/components/account/account-panel'

export const metadata: Metadata = {
  title: 'Your account',
  description: `Manage your ${siteConfig.name} account, library sync, lists and alerts.`,
  alternates: { canonical: '/account' },
  // Personal and per-visitor. The page is a static shell either way, so there is
  // nothing here worth indexing and a search result for it would be misleading.
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
}

export default function AccountPage() {
  return (
    // Wider than the reading pages: this one carries a 13rem section rail beside
    // the panel, and at max-w-4xl the panel that is left over is narrower than
    // the list editor inside it wants to be.
    //
    // min-h-svh is load-bearing, not decoration. Everything below is client-only
    // (the session is answered after hydration), so the prerendered shell is a
    // one-line spinner: the footer painted inside the viewport and was then
    // shoved down when the real panel arrived — a 0.48 CLS on every refresh.
    // Reserving a viewport of height keeps the footer below the fold until the
    // panel has settled, so the growth happens where nobody can see it.
    <section className="container max-w-5xl py-20 lg:py-28 min-h-svh">
      <AccountPanel />
    </section>
  )
}
