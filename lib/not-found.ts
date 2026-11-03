import { notFound } from 'next/navigation'

import { isNotFoundError } from '@/lib/fetch-client'

/**
 * For a page's `catch`: TMDB saying "no such id" is a 404 page; anything else
 * (429 after the retries, 5xx, a dropped socket, a bug) is NOT, and is rethrown.
 *
 * `catch { notFound() }` used to answer both the same way, so a TMDB read that
 * failed once at build time was baked into out/ as a "Page Not Found" noindex
 * shell for a real id, and shipped. Rethrowing fails the build loudly instead;
 * at runtime the error boundary shows an error, not a lie about the id.
 */
export function notFoundOrThrow(error: unknown): never {
  if (isNotFoundError(error)) notFound()
  throw error
}
