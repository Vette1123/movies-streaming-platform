import { cache } from 'react'

import { buildWsrvPlaceholderURL } from '@/lib/tmdbConfig'

/** ~1,000 detail pages ask during a build, and wsrv is a free public service. */
const MAX_IN_FLIGHT = 6
/** A blur is decoration: it must never be what slows a deploy down. */
const TIMEOUT_MS = 4000

let inFlight = 0
const waiting: (() => void)[] = []

const acquire = async () => {
  if (inFlight < MAX_IN_FLIGHT) {
    inFlight += 1
    return
  }
  // The releasing call hands its slot straight over, so inFlight stays put.
  await new Promise<void>((resolve) => waiting.push(resolve))
}

const release = () => {
  const next = waiting.shift()
  if (next) next()
  else inFlight -= 1
}

/**
 * The hero's blurred stand-in, or undefined. Fail-soft: a build without one just
 * shows the dark backing, which is what every other image does.
 */
export const getHeroPlaceholder = cache(
  async (backdropPath?: string | null) => {
    if (!backdropPath) return undefined
    await acquire()
    try {
      const response = await fetch(buildWsrvPlaceholderURL(backdropPath), {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      if (!response.ok) return undefined
      const dataUri = await response.text()
      return dataUri.startsWith('data:image/') ? dataUri : undefined
    } catch {
      return undefined
    } finally {
      release()
    }
  }
)
