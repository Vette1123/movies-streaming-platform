import Link from 'next/link'

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
        <Link href="/privacy" className="underline hover:text-foreground">
          Privacy
        </Link>{' '}
        ·{' '}
        <Link href="/terms" className="underline hover:text-foreground">
          Terms
        </Link>{' '}
        ·{' '}
        <Link href="/disclaimer" className="underline hover:text-foreground">
          Disclaimer
        </Link>
      </footer>
    </article>
  )
}
