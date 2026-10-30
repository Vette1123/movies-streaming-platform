import { buildWsrvPlaceholderURL } from '@/lib/tmdbConfig'

/**
 * The hero's blurred stand-in, or undefined. Fail-soft: a build without one just
 * shows the dark backing, which is what every other image does.
 */
export async function getHeroPlaceholder(backdropPath?: string | null) {
  if (!backdropPath) return undefined
  try {
    const response = await fetch(buildWsrvPlaceholderURL(backdropPath))
    if (!response.ok) return undefined
    const dataUri = await response.text()
    return dataUri.startsWith('data:image/') ? dataUri : undefined
  } catch {
    return undefined
  }
}
