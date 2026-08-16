'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Download, Loader2, LogOut, Trash2 } from 'lucide-react'

import { deleteAccount, signOut } from '@/lib/account'
import { clearSyncState, SYNCED_STORES } from '@/lib/library-sync'
import { cn } from '@/lib/utils'
import { useAccount } from '@/hooks/use-account'
import { readStore, writeStore } from '@/hooks/use-local-storage'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

/**
 * Everything about leaving.
 *
 * Export, wipe this device, sign out, delete. Grouped together on purpose: a
 * page that hides the exit is a page you cannot trust with anything, and the
 * privacy page promises all four of these in one place.
 */

interface ExportShape {
  exported_at: string
  account: { email: string | null; name: string | null } | null
  library: Record<string, unknown[]>
  lists?: unknown[]
}

/** The whole library, as one JSON file, built entirely in the browser. */
async function buildExport(
  account: { email: string | null; name: string | null; pro: boolean } | null
): Promise<ExportShape> {
  const library: Record<string, unknown[]> = {}
  for (const { key } of SYNCED_STORES) library[key] = readStore(key)

  const data: ExportShape = {
    exported_at: new Date().toISOString(),
    account: account ? { email: account.email, name: account.name } : null,
    library,
  }

  // Lists only exist server-side, and only for supporters. A failure here must
  // not cost somebody the library half of their export.
  if (account?.pro) {
    try {
      const response = await fetch('/api/lists')
      if (response.ok) {
        const body = await response.json()
        if (Array.isArray(body?.lists)) data.lists = body.lists
      }
    } catch {
      // Offline. The file still carries everything held on this device.
    }
  }

  return data
}

function download(data: unknown, filename: string): void {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  )
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  // Revoking immediately is safe: the click has already handed the blob to the
  // download, and leaving it unrevoked pins the whole library in memory.
  URL.revokeObjectURL(url)
}

export function DataPanel() {
  const account = useAccount()
  const [busy, setBusy] = useState(false)

  return (
    <div className="space-y-8">
      <Row
        title="Download everything"
        description="One JSON file with your saved titles, your watch history, every episode you have ticked off, and your lists if you have any. It is built in this browser, from your own data."
      >
        <Button
          variant="outline"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            const data = await buildExport(account)
            download(
              data,
              `reely-library-${new Date().toISOString().slice(0, 10)}.json`
            )
            setBusy(false)
          }}
        >
          {busy ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Download className="mr-2 size-4" />
          )}
          Export my data
        </Button>
      </Row>

      <ClearDevice pro={account.pro} />

      <Row
        title="Signed-in devices"
        description="Reely does not keep a list of your devices — only a hashed record that each one is signed in, which is what lets you end them all at once. Signing out everywhere ends every session including this one."
      >
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={() => {
              clearSyncState()
              void signOut()
            }}
          >
            <LogOut className="mr-2 size-4" />
            Sign out
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              clearSyncState()
              void signOut(true)
            }}
          >
            Sign out everywhere
          </Button>
        </div>
      </Row>

      <DeleteAccount email={account.email} pro={account.pro} />

      <p className="text-muted-foreground text-sm">
        What is stored, and what is never stored, is written out on the{' '}
        <Link href="/privacy" className="hover:text-foreground underline">
          privacy page
        </Link>
        .
      </p>
    </div>
  )
}

function Row({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-muted-foreground max-w-[65ch] text-sm leading-relaxed">
          {description}
        </p>
      </div>
      {children}
    </div>
  )
}

/**
 * Wipe the library held in this browser.
 *
 * For a supporter this is also the repair tool: clearing the local copy resets
 * the sync mirror, so the next sync pulls the server's copy back down rather
 * than deleting it — that is by construction in `collectChanges`, which
 * suppresses tombstones when the mirror is empty. The copy says so, because a
 * button that looks like it might delete a synced library is one nobody presses.
 */
function ClearDevice({ pro }: { pro: boolean }) {
  const [done, setDone] = useState(false)

  return (
    <Row
      title="Clear this device"
      description={
        pro
          ? 'Empties the copy held in this browser. Your synced library is untouched, and the next sync pulls it straight back down — which makes this the fix if this device has drifted out of step.'
          : 'Empties your saved titles, watch history and ticked-off episodes from this browser. There is no other copy, so this cannot be undone.'
      }
    >
      {done ? (
        <p className="text-muted-foreground text-sm">
          Cleared.{pro ? ' Your synced copy comes back on the next sync.' : ''}
        </p>
      ) : (
        <ConfirmDialog
          trigger={
            <Button variant="outline">
              <Trash2 className="mr-2 size-4" />
              Clear browser data
            </Button>
          }
          title="Clear this browser's copy?"
          description={
            pro
              ? 'Your synced library is untouched and comes straight back on the next sync. This is the repair, not the delete.'
              : 'Your saved titles, watch history and ticked-off episodes are removed from this browser. There is no other copy of them.'
          }
          confirmLabel="Yes, clear this device"
          Icon={Trash2}
          onConfirm={() => {
            for (const { key } of SYNCED_STORES) writeStore(key, [])
            clearSyncState()
            setDone(true)
          }}
        />
      )}
    </Row>
  )
}

function DeleteAccount({ email, pro }: { email: string | null; pro: boolean }) {
  const [error, setError] = useState<string | null>(null)

  const remove = async () => {
    setError(null)
    const result = await deleteAccount()
    if (!result.ok) {
      setError(result.error ?? 'Could not delete the account.')
      return
    }
    clearSyncState()
    window.location.href = '/'
  }

  return (
    <div className="border-destructive/30 space-y-3 rounded-lg border p-4">
      <h3 className="text-sm font-semibold">Delete this account</h3>
      <p className="text-muted-foreground max-w-[65ch] text-sm leading-relaxed">
        Removes {email ?? 'your address'}, your synced library, your lists and
        every device you are signed in on. It does not touch what is stored in
        this browser, so Reely keeps working exactly as it does for anyone
        signed out.
        {pro
          ? ' Supporting is separate: cancel that on Buy Me a Coffee if you want it stopped.'
          : ''}
      </p>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <ConfirmDialog
        trigger={
          <Button
            variant="ghost"
            className={cn('text-destructive hover:text-destructive')}
          >
            Delete account
          </Button>
        }
        title="Delete this account?"
        description={`${email ?? 'Your address'}, your synced library, your lists and every signed-in device go with it. This cannot be undone.`}
        confirmLabel="Yes, delete it"
        cancelLabel="Keep it"
        Icon={Trash2}
        onConfirm={remove}
      >
        <p className="text-muted-foreground text-sm leading-relaxed">
          What is in this browser stays: Reely keeps working exactly as it does
          for anyone signed out.
          {pro
            ? ' Supporting is billed separately — cancel that on Buy Me a Coffee if you want it stopped.'
            : ''}
        </p>
      </ConfirmDialog>
    </div>
  )
}
