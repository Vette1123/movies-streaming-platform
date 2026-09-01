import React from 'react'
import Link from 'next/link'

const SIBLINGS = [
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/disclaimer', label: 'Disclaimer' },
]

// `inline-block py-1` takes the row from a 17px line box to 25px. They sit on
// their own line as a standalone set of targets, so WCAG 2.2's exception for a
// link inside a sentence does not apply to them.
function SiblingLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-block py-1 underline hover:text-foreground"
    >
      {label}
    </Link>
  )
}

/**
 * The shell both legal pages render into.
 *
 * They are the same document shape (a title, a date, a column of prose at a
 * readable measure), and two hand-built copies of that is how the privacy page
 * ends up with a different heading scale from the terms page after one edit.
 * `prose` comes from @tailwindcss/typography, which is already installed.
 */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string
  updated: string
  children: React.ReactNode
}) {
  return (
    <article className="container max-w-3xl py-20 lg:py-28">
      <header className="mb-10 space-y-2">
        <h1 className="text-3xl font-bold tracking-tight lg:text-4xl">
          {title}
        </h1>
        <p className="text-sm text-muted-foreground">Last updated {updated}</p>
      </header>

      <div className="prose max-w-none prose-invert prose-headings:font-semibold prose-headings:tracking-tight prose-h2:mt-10 prose-h2:text-xl prose-p:leading-relaxed prose-li:leading-relaxed">
        {children}
      </div>

      <footer className="mt-14 border-t pt-6 text-sm text-muted-foreground">
        {SIBLINGS.map(({ href, label }, index) => (
          <React.Fragment key={href}>
            {index > 0 ? ' · ' : null}
            <SiblingLink href={href} label={label} />
          </React.Fragment>
        ))}
      </footer>
    </article>
  )
}
