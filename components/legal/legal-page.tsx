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
        <p className="text-muted-foreground text-sm">Last updated {updated}</p>
      </header>

      <div className="prose prose-invert prose-headings:tracking-tight prose-headings:font-semibold prose-h2:text-xl prose-h2:mt-10 prose-p:leading-relaxed prose-li:leading-relaxed max-w-none">
        {children}
      </div>

      <footer className="text-muted-foreground mt-14 border-t pt-6 text-sm">
        <Link href="/privacy" className="hover:text-foreground underline">
          Privacy
        </Link>{' '}
        ·{' '}
        <Link href="/terms" className="hover:text-foreground underline">
          Terms
        </Link>{' '}
        ·{' '}
        <Link href="/disclaimer" className="hover:text-foreground underline">
          Disclaimer
        </Link>
      </footer>
    </article>
  )
}
