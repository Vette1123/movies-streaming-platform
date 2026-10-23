'use client'

import React, { useCallback, useState } from 'react'
import { Download, Upload } from 'lucide-react'

import { trackFeatureUsed } from '@/lib/analytics'
import { useWatchlist } from '@/hooks/use-watchlist'
import { Button } from '@/components/ui/button'

/**
 * Export / import of the localStorage watchlist as a JSON file.
 *
 * Import is offered even when the list is empty: restoring a backup into a
 * fresh browser is the main reason to have it.
 */
export function WatchlistTransfer() {
  const { watchlist, exportWatchlist, importWatchlist } = useWatchlist()
  const [importError, setImportError] = useState<string | null>(null)

  const handleImport = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      setImportError(null)
      const file = e.target.files?.[0]
      if (!file) return
      try {
        await importWatchlist(file)
        e.target.value = ''
        trackFeatureUsed({
          feature: 'watchlist_transfer',
          action: 'imported',
          outcome: 'ok',
        })
      } catch (err) {
        setImportError(err instanceof Error ? err.message : 'Import failed.')
        trackFeatureUsed({
          feature: 'watchlist_transfer',
          action: 'imported',
          outcome: 'failed',
        })
      }
    },
    [importWatchlist]
  )

  return (
    <div className="flex flex-wrap items-center gap-2">
      {watchlist.length > 0 && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            exportWatchlist()
            trackFeatureUsed({
              feature: 'watchlist_transfer',
              action: 'exported',
              items: watchlist.length,
            })
          }}
        >
          <Download className="mr-2 size-4" />
          Export
        </Button>
      )}
      <Button variant="outline" size="sm" asChild>
        <label className="cursor-pointer">
          <Upload className="mr-2 size-4" />
          Import
          <input
            type="file"
            accept=".json,application/json"
            className="sr-only"
            onChange={handleImport}
          />
        </label>
      </Button>
      {importError && (
        <span role="alert" className="text-sm text-destructive">
          {importError}
        </span>
      )}
    </div>
  )
}
