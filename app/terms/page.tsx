import { Metadata } from 'next'
import Link from 'next/link'

import { siteConfig } from '@/config/site'
import {
  SUPPORT_EMAIL,
  supportMailto,
  supportPriceLine,
} from '@/config/support'
import { LegalPage } from '@/components/legal/legal-page'

export const metadata: Metadata = {
  title: 'Terms',
  description: `The terms for using ${siteConfig.name}, including accounts and supporter memberships.`,
  alternates: { canonical: '/terms' },
  robots: { index: true, follow: true },
  openGraph: {
    title: `Terms | ${siteConfig.name}`,
    description: `The terms for using ${siteConfig.name}, including accounts and supporter memberships.`,
    url: `${siteConfig.websiteURL}/terms`,
    type: 'article',
    images: '/opengraph-image.png',
  },
}

export default function TermsPage() {
  return (
    <LegalPage title="Terms" updated="15 August 2026">
      <p>
        {siteConfig.name} is a personal project that helps you find, track and
        watch films and television. Using it means accepting what follows. It is
        deliberately short.
      </p>

      <h2>What this site is</h2>
      <p>
        Catalogue information comes from The Movie Database. Playback is
        provided by third-party embeds that {siteConfig.name} neither hosts nor
        controls. See the <Link href="/disclaimer">disclaimer</Link> for what
        that means in practice: no media is stored, uploaded or served here.
      </p>

      <h2>Accounts</h2>
      <p>
        An account is optional. You need a Google account to create one, you
        must be old enough to hold one under Google&apos;s own terms, and you
        are responsible for what happens under yours. You can delete it at any
        time from your <Link href="/account">account page</Link>, which removes
        everything stored against it.
      </p>
      <p>
        An account may be suspended without notice if it is used to attack the
        service, to abuse the API on other people&apos;s behalf, or to publish
        illegal content through a shared list.
      </p>

      <h2>Supporter memberships</h2>
      <p>
        Supporting {siteConfig.name} is voluntary and never required. It costs{' '}
        {supportPriceLine()} It is bought and billed through Buy Me a Coffee,
        who are the merchant of record and whose terms apply to the payment
        itself.
      </p>
      <ul>
        <li>
          A monthly or yearly membership renews automatically until you cancel
          it.
        </li>
        <li>
          Cancelling takes effect at the end of the period you have already paid
          for. You keep supporter features until then.
        </li>
        <li>
          The Lifetime is a single payment with nothing to renew and nothing to
          cancel. It is not revoked.
        </li>
        <li>
          Supporter status attaches to the email address the payment was made
          with. If that is not the address you sign in with, email{' '}
          {SUPPORT_EMAIL} and it will be moved across.
        </li>
      </ul>
      <p>
        Refunds: if support was bought by mistake, or the supporter features did
        not work for you, ask within 14 days and it will be refunded. Ask
        through Buy Me a Coffee or by email.
      </p>

      <h2>What support does not buy</h2>
      <p>
        Everything free stays free. Support does not unlock content, does not
        change what any title can be watched on, and does not grant access to
        anything a visitor could not already reach. It pays for the running
        costs and the time, and it unlocks features of this site: library sync,
        lists, alerts, appearance, and the statistics page.
      </p>

      <h2>Availability</h2>
      <p>
        This is one person&apos;s project running on a free hosting plan. There
        is no uptime guarantee, features may change, and the site is provided as
        it is, without warranty of any kind. Nothing here is a guarantee that a
        particular title will be available at a particular time.
      </p>

      <h2>Liability</h2>
      <p>
        To the extent the law allows, {siteConfig.name} is not liable for
        indirect or consequential loss arising from using it. Nothing in these
        terms limits any liability that cannot be limited by law, including your
        statutory rights as a consumer.
      </p>

      <h2>Changes</h2>
      <p>
        These terms may change. The date at the top of this page says when they
        last did. A change that affects supporters materially will be sent to
        the address on the membership.
      </p>

      <h2>Contact</h2>
      <p>
        <a href={supportMailto('Terms')}>{SUPPORT_EMAIL}</a>
      </p>
    </LegalPage>
  )
}
