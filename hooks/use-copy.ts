'use client'

import * as React from 'react'
import { toast } from 'sonner'

import { copyText } from '@/lib/copy-text'

const RESET_MS = 2000

/**
 * A copy button's state. `copied` names which copy last succeeded (one panel
 * can hold several buttons) and clears after 2s; a failed copy shows nothing
 * as copied and says so in a toast, which is also announced to screen readers.
 */
export function useCopy<K extends string = 'default'>() {
  const [copied, setCopied] = React.useState<K | null>(null)
  const timer = React.useRef<ReturnType<typeof setTimeout>>(undefined)

  React.useEffect(() => () => clearTimeout(timer.current), [])

  const copy = React.useCallback(
    async (text: string, key = 'default' as K): Promise<boolean> => {
      const ok = await copyText(text)
      clearTimeout(timer.current)
      if (!ok) {
        setCopied(null)
        toast.error("Couldn't copy. Select the text and copy it by hand.")
        return false
      }
      setCopied(key)
      timer.current = setTimeout(() => setCopied(null), RESET_MS)
      return true
    },
    []
  )

  return { copied, copy }
}
