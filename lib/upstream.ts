import { isNotFoundError } from '@/lib/fetch-client'

/** TMDB failed for a reason that says nothing about whether the id exists. */
export class UpstreamUnavailable extends Error {
  constructor(cause: unknown) {
    super(`TMDB unavailable: ${String(cause)}`)
    this.name = 'UpstreamUnavailable'
    this.cause = cause
  }
}

/**
 * For the Worker loaders' `catch`: a TMDB 404 is `null` ("no such id", which
 * becomes a 404 page); every other failure is UpstreamUnavailable, which the
 * Worker turns into a 503 + Retry-After. A crawler that sees a 404 drops the
 * URL; one that sees a 503 comes back.
 */
export const nullIfNotFound = (error: unknown): null => {
  if (isNotFoundError(error)) return null
  throw error instanceof UpstreamUnavailable
    ? error
    : new UpstreamUnavailable(error)
}

export const isUpstreamUnavailable = (error: unknown): boolean =>
  error instanceof UpstreamUnavailable
