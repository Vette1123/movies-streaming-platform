import { Metadata } from 'next'
import Link from 'next/link'

import { siteConfig } from '@/config/site'
import { LegalPage } from '@/components/legal/legal-page'

export const metadata: Metadata = {
  title: 'Privacy',
  description: `What ${siteConfig.name} stores, what it does not, and how to delete it. Free users are anonymous; signing in is optional.`,
  alternates: { canonical: '/privacy' },
  robots: { index: true, follow: true },
  openGraph: {
    title: `Privacy | ${siteConfig.name}`,
    description: `What ${siteConfig.name} stores, what it does not, and how to delete it.`,
    url: `${siteConfig.websiteURL}/privacy`,
    type: 'article',
    images: '/opengraph-image.png',
  },
}

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy" updated="15 August 2026">
      <p>
        There are two ways to use {siteConfig.name}, and they are genuinely
        different in what they store. This page describes both without
        flattening them together.
      </p>

      <h2>If you never sign in</h2>
      <p>
        Nothing about you is stored on any server we run. No account, no
        profile, no identifier. Your watchlist, your watch history and the
        episodes you tick off are written to this browser&apos;s local storage
        and stay there: they are never uploaded, and clearing your browser data
        removes them permanently.
      </p>
      <p>
        Pages are served as static files, and requests for catalogue data go to
        The Movie Database on your behalf. Those requests carry no identifier of
        yours.
      </p>

      <h2>If you sign in with Google</h2>
      <p>Signing in is optional and adds an account. It stores:</p>
      <ul>
        <li>your email address, as Google reports it;</li>
        <li>
          your Google account identifier, which is what tells us it is you next
          time;
        </li>
        <li>
          your display name and avatar URL, if Google provides them, purely so
          the site can show them back to you;
        </li>
        <li>
          a hashed record of each device you are signed in on, so you can sign
          out of them;
        </li>
        <li>your preferences: accent, layout density, and alert settings.</li>
      </ul>
      <p>
        Google performs the authentication. {siteConfig.name} never sees your
        password, and we do not request or store a Google refresh token, so
        nothing about your continued access depends on Google after you have
        signed in once.
      </p>

      <h2>If you support the project</h2>
      <p>
        Supporters can sync their library. When that is on, the titles you have
        saved, the ones you have watched, and the episodes you have ticked off
        are stored against your account so they appear on your other devices.
        Lists you create are stored the same way. A list is private until you
        publish it, and a published list is a public page for as long as you
        leave it published.
      </p>
      <p>
        Payment is handled entirely by Buy Me a Coffee. {siteConfig.name} never
        receives a card number. What we receive from them is the email address a
        payment was made with and the name of the offer bought, which is what
        switches supporter status on.
      </p>

      <h2>What is never stored, for anyone</h2>
      <ul>
        <li>IP addresses.</li>
        <li>Passwords.</li>
        <li>
          What you play. The player is a third-party embed and nothing about a
          playback is recorded here.
        </li>
        <li>
          Anything sold or shared with a data broker, an advertiser, or anyone
          else. There is no such arrangement and there will not be one.
        </li>
      </ul>

      <h2>Analytics</h2>
      <p>
        {siteConfig.name} uses PostHog for product analytics: which pages are
        viewed, which features are used, and errors that occur. It is used to
        find out what is broken and what nobody uses. It is not tied to your
        account, and it is not used to build a profile of what you watch.
      </p>

      <h2>Deleting everything</h2>
      <p>
        The delete button on your <Link href="/account">account page</Link>{' '}
        removes your account, your synced library, your lists, your preferences
        and every signed-in device, immediately and without a recovery window.
        What is stored in your browser is yours to clear at any time from your
        browser&apos;s settings.
      </p>
      <p>
        If support is active, deleting the account does not cancel it. Cancel on
        Buy Me a Coffee first, or it keeps charging with nothing attached to it.
      </p>

      <h2>Getting in touch</h2>
      <p>
        Questions, or a request about your data, go to{' '}
        <a href={`mailto:${siteConfig.author.email}`}>
          {siteConfig.author.email}
        </a>
        .
      </p>
    </LegalPage>
  )
}
