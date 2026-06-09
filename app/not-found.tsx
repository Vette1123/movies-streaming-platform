import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Page Not Found',
  description: 'The page you are looking for does not exist.',
  robots: { index: false, follow: false },
}

export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-6xl font-bold">404</h1>
      <p className="text-muted-foreground text-xl">
        This page could not be found.
      </p>
      <div className="flex gap-4">
        <Link
          href="/"
          className="bg-primary text-primary-foreground rounded-md px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
        >
          Go Home
        </Link>
        <Link
          href="/movies"
          className="rounded-md border px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
        >
          Browse Movies
        </Link>
      </div>
    </main>
  )
}
