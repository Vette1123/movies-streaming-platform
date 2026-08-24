'use client'

import * as React from 'react'
import { toast } from 'sonner'

import { siteConfig } from '@/config/site'

interface ShareInput {
  title: string
  /** Path like /movie/123-slug — made absolute here so shares always land on
   * the canonical host, whatever page the sharer was reading. */
  path: string
}

/** The only rejection that means "the user decided". */
const isDismissal = (error: unknown) =>
  error instanceof DOMException && error.name === 'AbortError'

/**
 * Native share sheet where the platform has one (every mobile browser, desktop
 * Safari/Chrome/Edge), clipboard + toast everywhere else. Returns whether the
 * native path was used, for callers that want to restyle after sharing.
 */
export const useShare = () => {
  const [nativeShared, setNativeShared] = React.useState(false)

  const share = React.useCallback(async ({ title, path }: ShareInput) => {
    const url = `${siteConfig.websiteURL}${path}`
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title, text: `Watch ${title} on Reely`, url })
        setNativeShared(true)
        return true
      }
    } catch (error) {
      // Dismissing the sheet is the user saying no — that is the one failure
      // that must NOT be second-guessed with a clipboard write.
      if (isDismissal(error)) return false
      // Everything else means the sheet never opened: the API exists but the
      // platform cannot service it (desktop Chrome outside a share target,
      // a page without transient activation, a locked-down webview). Before
      // this, the tap did nothing at all and said nothing.
    }
    await navigator.clipboard?.writeText(url)
    toast('Link copied — share it anywhere')
    return false
  }, [])

  return { share, nativeShared }
}
