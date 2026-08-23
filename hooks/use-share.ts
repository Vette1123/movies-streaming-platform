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
    } catch {
      // A dismissed share sheet is not an error — fall through to copy only
      // when the API itself was missing.
      return false
    }
    await navigator.clipboard?.writeText(url)
    toast('Link copied — share it anywhere')
    return false
  }, [])

  return { share, nativeShared }
}
