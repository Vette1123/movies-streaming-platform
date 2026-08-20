'use client'

import { useMemo } from 'react'
import { Check, CloudOff, RefreshCw, TriangleAlert } from 'lucide-react'

import { SYNCED_STORES } from '@/lib/library-sync'
import { useAccount } from '@/hooks/use-account'
import { useLibrarySync } from '@/hooks/use-library-sync'
import { useLocalStorage } from '@/hooks/use-local-storage'
import { Button } from '@/components/ui/button'

import { LibrarySearch } from './library-search'
import { SupporterGate } from './supporter-gate'

/**
 * The library section: what is synced, and whether it is.
 *
 * The counts come from localStorage, not from the server, and that is the point
 * being made visually as well as technically — the library is on the device, and
 * sync is a copy of it kept somewhere safe.
 */
export function LibraryPanel() {
  const { pro } = useAccount()
  const { status, syncNow } = useLibrarySync()

  const [watchlist] = useLocalStorage('watchlist', [])
  const [history] = useLocalStorage('watchedItems', [])
  const [completed] = useLocalStorage('completedItems', [])
  const [reviews] = useLocalStorage('reviews', [])

  const counts: Record<string, number> = useMemo(
    () => ({
      watchlist: watchlist.length,
      watchedItems: history.length,
      completedItems: completed.length,
      reviews: reviews.length,
    }),
    [completed.length, history.length, reviews.length, watchlist.length]
  )

  if (!pro) {
    return (
      <SupporterGate title="Your library, on every device">
        Right now your saved titles, watch history and ticked-off episodes live
        in this browser and nowhere else. A new phone starts from nothing.
        Supporting Reely keeps all three in step across everything you sign in
        on, and puts them somewhere a cleared browser cannot take them.
      </SupporterGate>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SYNCED_STORES.map(({ key, label }) => (
          <div key={key} className="bg-card/50 rounded-lg border p-4">
            <p className="font-mono text-2xl font-semibold tabular-nums">
              {counts[key] ?? 0}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">{label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SyncStatus status={status} />
        <Button
          size="sm"
          variant="outline"
          onClick={() => void syncNow()}
          disabled={status === 'syncing'}
        >
          <RefreshCw
            className={`mr-2 size-4 ${status === 'syncing' ? 'animate-spin' : ''}`}
          />
          Sync now
        </Button>
      </div>

      <p className="text-muted-foreground max-w-[65ch] text-sm leading-relaxed">
        Changes sync a couple of seconds after you make them, and whenever you
        leave the tab. Nothing is recorded about what you watch beyond the
        titles you save and tick off yourself, and deleting your account takes
        all of it with you.
      </p>

      <LibrarySearch />
    </div>
  )
}

function SyncStatus({ status }: { status: string }) {
  if (status === 'syncing') {
    return (
      <p className="text-muted-foreground flex items-center gap-2 text-sm">
        <RefreshCw className="size-4 animate-spin" /> Syncing
      </p>
    )
  }
  if (status === 'error') {
    return (
      <p className="text-muted-foreground flex items-center gap-2 text-sm">
        <TriangleAlert className="size-4" /> Could not reach the server. Your
        library is safe on this device and will sync when it is back.
      </p>
    )
  }
  if (status === 'offline') {
    return (
      <p className="text-muted-foreground flex items-center gap-2 text-sm">
        <CloudOff className="size-4" /> Offline
      </p>
    )
  }
  return (
    <p className="text-muted-foreground flex items-center gap-2 text-sm">
      <Check className="size-4" /> Up to date
    </p>
  )
}
