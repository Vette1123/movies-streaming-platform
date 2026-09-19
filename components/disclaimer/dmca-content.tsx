import React from 'react'
import Link from 'next/link'

import { SUPPORT_EMAIL } from '@/config/support'

/**
 * The notice-and-takedown page.
 *
 * A disclaimer says what the site is not responsible for. This says what
 * actually happens when somebody sends a notice, which is the part a rights
 * holder is looking for and the part that decides whether the first contact is
 * an email or a letter from a lawyer. It is deliberately specific — a named
 * address, the fields a notice needs, and a stated turnaround — because a page
 * that says "we respect copyright" and gives no route to a human is read,
 * correctly, as having no process at all.
 *
 * Everything claimed here is backed by something real: `pnpm takedown` writes
 * config/blocked-titles.json, the Worker refuses to mint a playback ticket for
 * anything in it, and the detail heroes mount no player. Do not add a promise
 * to this page that nothing in the repo keeps.
 */

const Section = ({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) => (
  <section className="space-y-3">
    <h2 className="text-lg font-semibold tracking-tight text-foreground">
      {title}
    </h2>
    {children}
  </section>
)

export const DmcaContent = () => (
  <div className="mx-auto flex max-w-3xl flex-col gap-10">
    <header className="space-y-3">
      <h1 className="text-2xl font-semibold tracking-tight">
        Copyright &amp; takedown requests
      </h1>
      <p className="text-sm text-muted-foreground">
        How to report material on this site, and what happens next.
      </p>
    </header>

    <Section title="Where to send a notice">
      <p className="text-base leading-relaxed text-muted-foreground">
        Email{' '}
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="font-medium text-primary underline underline-offset-4"
        >
          {SUPPORT_EMAIL}
        </a>{' '}
        with &ldquo;Copyright&rdquo; in the subject line. A notice sent here
        reaches the operator directly and is the fastest route. Notices sent
        through the hosting provider reach us too, just later.
      </p>
    </Section>

    <Section title="What a notice needs">
      <ul className="list-disc space-y-2 pl-5 text-base leading-relaxed text-muted-foreground">
        <li>
          The work being claimed — a title plus an IMDb or TMDB link is enough
          to identify it without ambiguity.
        </li>
        <li>
          The exact page URL or URLs on this site, for example
          <code className="ml-1 rounded bg-muted px-1.5 py-0.5 text-sm">
            /movies/12345
          </code>
          .
        </li>
        <li>Who you are, who you act for, and how to reach you.</li>
        <li>
          A statement that you believe in good faith the use is not authorised,
          and that the information in the notice is accurate.
        </li>
      </ul>
    </Section>

    <Section title="What happens then">
      <p className="text-base leading-relaxed text-muted-foreground">
        Playback for the reported title is disabled across the whole site — for
        every visitor, on every device, whether or not they hold an account.
        There is no tier that keeps access. The block is enforced both on the
        server, which refuses to authorise playback, and in the page itself,
        which stops offering it.
      </p>
      <p className="text-base leading-relaxed text-muted-foreground">
        We aim to action a complete notice within 24 hours of reading it, and we
        record the date and your reference so the timeline can be confirmed
        later.
      </p>
    </Section>

    <Section title="What stays up, and why">
      <p className="text-base leading-relaxed text-muted-foreground">
        The title&rsquo;s information page remains: the synopsis, cast, artwork,
        release dates, ratings and trailer. That material comes from{' '}
        <a
          href="https://www.themoviedb.org/"
          rel="noreferrer noopener"
          target="_blank"
          className="font-medium text-primary underline underline-offset-4"
        >
          TMDB
        </a>{' '}
        and is shown under their terms, and a notice about a stream is not a
        notice about a filmography. If you believe the page itself infringes,
        say so explicitly in your notice and it will be considered on its own.
      </p>
    </Section>

    <Section title="Repeat infringement">
      <p className="text-base leading-relaxed text-muted-foreground">
        Third-party sources that are the subject of repeated substantiated
        notices are removed from the site&rsquo;s source list entirely, not just
        for the reported title. Accounts used to circumvent a block are closed.
      </p>
    </Section>

    <Section title="If you think we got it wrong">
      <p className="text-base leading-relaxed text-muted-foreground">
        If a title was blocked in error — you hold the rights, or you licensed
        the use — email the same address with the details and it will be
        restored. Please do not file a counter-notice before contacting us; it
        is slower for both of us.
      </p>
    </Section>

    <footer className="border-t border-border pt-6">
      <p className="text-sm text-muted-foreground">
        See also the{' '}
        <Link
          href="/disclaimer"
          className="font-medium text-primary underline underline-offset-4"
        >
          disclaimer
        </Link>
        , which covers where the information on this site comes from and who
        owns it.
      </p>
    </footer>
  </div>
)
