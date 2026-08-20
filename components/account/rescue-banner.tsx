'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CloudOff, X } from 'lucide-react'

import { rescueLine, shouldOfferRescue } from '@/lib/rescue'
import { useAccount } from '@/hooks/use-account'
import { useLocalStorage } from '@/hooks/use-local-storage'
import { useMounted } from '@/hooks/use-mounted'
import { Button, buttonVariants } from '@/components/ui/button'

const DISMISS_KEY = 'reely.rescue.dismissed'

/**
 * The warning above somebody's own library, when that library exists nowhere
 * else.
 *
 * Rendered on the watchlist and watch-history pages — where the thing at risk
 * is on screen — rather than on the home page, where it would be an ad. It
 * disappears the moment somebody signs in, and it never comes back once
 * dismissed.
 */
export function RescueBanner() {
  const { signedIn } = useAccount()
  const mounted = useMounted()
  const [watchlist] = useLocalStorage('watchlist', [])
  const [history] = useLocalStorage('watchedItems', [])
  const [completed] = useLocalStorage('completedItems', [])
  const [dismissed, setDismissed] = useState(
    () =>
      typeof window !== 'undefined' && localStorage.getItem(DISMISS_KEY) === '1'
  )

  const counts = {
    saved: watchlist.length,
    history: history.length,
    finished: completed.length,
  }

  // Nothing is read from localStorage on the server or the first paint, so
  // rendering before mount would flash a banner that says zero of everything.
  if (!mounted) return null
  if (!shouldOfferRescue(counts, signedIn, dismissed)) return null

  return (
    <div className="border-primary/25 from-primary/10 relative mb-8 rounded-lg border bg-gradient-to-br to-transparent p-5 sm:p-6">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Dismiss"
        className="absolute top-2 right-2"
        onClick={() => {
          localStorage.setItem(DISMISS_KEY, '1')
          setDismissed(true)
        }}
      >
        <X className="size-4" />
      </Button>

      <div className="flex flex-col gap-4 pr-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-[58ch] space-y-1">
          <p className="flex items-center gap-2 font-medium">
            <CloudOff className="size-4 shrink-0" />
            {rescueLine(counts)}
          </p>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Clear this browser, switch phones or open a private window and it is
            gone. Signing in with Google is free, takes one tap, and keeps all
            of it — nothing about it is a paid feature.
          </p>
        </div>
        <Link
          href="/account"
          className={buttonVariants({ className: 'shrink-0' })}
        >
          Keep my library
        </Link>
      </div>
    </div>
  )
}
