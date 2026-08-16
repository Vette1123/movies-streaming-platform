'use client'

/**
 * The library sync engine: three localStorage stores kept the same on every
 * device an account is signed in on.
 *
 * The app itself is untouched by this. Every hook, card and page still reads and
 * writes localStorage exactly as it did before an account existed, which is what
 * keeps the site fully working for the (large) majority of visitors who never
 * sign in. This module observes those stores, ships what changed, and applies
 * what came back.
 *
 * Deletes are the part that needs care. A store is an array, so a removed item
 * is simply absent — indistinguishable from an item this device has never seen.
 * A MIRROR of the last synced state is therefore kept alongside: what is in the
 * mirror and no longer in the store was deleted here, and becomes a tombstone.
 * Without it, deleting a title on your phone would have it reappear from your
 * laptop forever.
 */
import {
  readStore,
  subscribeStore,
  type WatchedItem,
} from '@/hooks/use-local-storage'

/** localStorage key → the server-side store name. */
export const SYNCED_STORES = [
  { key: 'watchlist', store: 'watchlist' },
  { key: 'watchedItems', store: 'history' },
  { key: 'completedItems', store: 'completed' },
  { key: 'reviews', store: 'reviews' },
] as const

const MIRROR_KEY = 'reely_sync_mirror'
const CURSOR_KEY = 'reely_sync_since'

/**
 * The identity of one row.
 *
 * A title appears once per store, except in `completedItems`, where one row is
 * one episode. The watchlist's own key is deliberately `series:1399` rather than
 * a bare id, because that is exactly the string the alert sweep matches against
 * (`lib/push/sweep.ts`) — one shape, matched in one place.
 */
export function itemKey(item: WatchedItem): string {
  const base = `${item.type}:${item.id}`
  if (item.season === undefined || item.episode === undefined) return base
  return `${base}:${item.season}:${item.episode}`
}

/** When this row last changed, as epoch millis. */
export function itemStamp(item: WatchedItem): number {
  const stamp = Date.parse(item.modified_at || item.added_at || '')
  return Number.isFinite(stamp) ? stamp : Date.now()
}

type Mirror = Record<string, Record<string, number>>

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Full or blocked storage. The next sync recomputes the diff from whatever
    // mirror survived; worst case some unchanged rows are re-sent.
  }
}

export interface OutboundChange {
  store: string
  key: string
  payload: WatchedItem | null
  updated_at: number
}

/**
 * What changed here since the last sync.
 *
 * `firstRun` (an empty mirror) suppresses tombstones entirely, and that is the
 * rule that makes signing in on a second device safe: this device has never
 * uploaded anything, so everything the SERVER holds is missing from its store —
 * and treating "missing locally" as "deleted" would wipe the library it just
 * signed in to find.
 */
export function collectChanges(
  stores: { key: string; store: string }[],
  read: (key: string) => WatchedItem[],
  mirror: Mirror,
  now: number
): { changes: OutboundChange[]; next: Mirror } {
  const changes: OutboundChange[] = []
  const next: Mirror = {}

  for (const { key, store } of stores) {
    const items = read(key)
    const previous = mirror[store] ?? {}
    const firstRun = Object.keys(previous).length === 0
    const current: Record<string, number> = {}

    for (const item of items) {
      const id = itemKey(item)
      const stamp = itemStamp(item)
      current[id] = stamp
      if (previous[id] === undefined || previous[id] < stamp) {
        changes.push({ store, key: id, payload: item, updated_at: stamp })
      }
    }

    if (!firstRun) {
      for (const id of Object.keys(previous)) {
        if (current[id] !== undefined) continue
        changes.push({ store, key: id, payload: null, updated_at: now })
        // The tombstone is remembered too, so it is sent once rather than on
        // every sync for the rest of this browser's life.
        current[id] = now
      }
    }

    next[store] = current
  }

  return { changes, next }
}

export interface InboundChange {
  store: string
  key: string
  /** JSON, or null for a tombstone. */
  payload: string | null
  updated_at: number
}

/**
 * Apply what the server sent to one store's array.
 *
 * Pure, and returns the same reference when nothing changed, so a sync that
 * pulls nothing re-renders nothing.
 */
export function applyChanges(
  items: WatchedItem[],
  incoming: InboundChange[]
): WatchedItem[] {
  if (incoming.length === 0) return items

  const byKey = new Map(items.map((item) => [itemKey(item), item]))
  let dirty = false

  for (const change of incoming) {
    if (change.payload === null) {
      if (byKey.delete(change.key)) dirty = true
      continue
    }
    try {
      const parsed = JSON.parse(change.payload) as WatchedItem
      // A payload whose key disagrees with the row it arrived under would put an
      // item where nothing can find it again. Drop it rather than store it.
      if (itemKey(parsed) !== change.key) continue
      const existing = byKey.get(change.key)
      if (existing && itemStamp(existing) >= change.updated_at) continue
      byKey.set(change.key, parsed)
      dirty = true
    } catch {
      // A corrupt row from an older client. Skipping it is strictly better than
      // failing the whole sync it arrived in.
    }
  }

  if (!dirty) return items
  return [...byKey.values()]
}

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline'

interface SyncResult {
  ok: boolean
  /** True when the server has more rows than one pull returned. */
  more: boolean
}

/**
 * One round trip: push everything that changed here, apply everything that
 * changed elsewhere.
 *
 * Exported so the account page can offer a "sync now" that is the same code path
 * as the automatic one, rather than a second implementation that drifts.
 */
export async function syncOnce(
  write: (key: string, items: WatchedItem[]) => void
): Promise<SyncResult> {
  // Module-scoped, not per-caller: the layout drives sync for the whole app, and
  // the account page's "sync now" is a second `useLibrarySync` on the same page.
  // Two overlapping runs would each diff against a mirror the other is about to
  // replace and upload the same rows twice. Joining the run in flight is both
  // correct and one request cheaper.
  if (inFlightSync) return inFlightSync
  inFlightSync = runSync(write).finally(() => {
    inFlightSync = null
  })
  return inFlightSync
}

let inFlightSync: Promise<SyncResult> | null = null

async function runSync(
  write: (key: string, items: WatchedItem[]) => void
): Promise<SyncResult> {
  const now = Date.now()
  const mirror = readJson<Mirror>(MIRROR_KEY, {})
  const since = readJson<number>(CURSOR_KEY, 0)

  const { changes, next } = collectChanges(
    SYNCED_STORES as unknown as { key: string; store: string }[],
    readStore,
    mirror,
    now
  )

  let response: Response
  try {
    response = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ since, changes }),
    })
  } catch {
    return { ok: false, more: false }
  }

  if (!response.ok) return { ok: false, more: false }

  const data = (await response.json().catch(() => null)) as {
    success?: boolean
    now?: number
    more?: boolean
    changes?: InboundChange[]
  } | null
  if (!data?.success) return { ok: false, more: false }

  const inbound = data.changes ?? []
  for (const { key, store } of SYNCED_STORES) {
    const forStore = inbound.filter((change) => change.store === store)
    if (forStore.length === 0) continue
    const items = readStore(key)
    const merged = applyChanges(items, forStore)
    if (merged !== items) write(key, merged)

    // Fold what was just applied into the mirror, so the very next diff does not
    // read a pulled item as a local creation and send it straight back.
    const mine = next[store] ?? {}
    for (const change of forStore) {
      if (change.payload === null) delete mine[change.key]
      else mine[change.key] = change.updated_at
    }
    next[store] = mine
  }

  writeJson(MIRROR_KEY, next)
  writeJson(CURSOR_KEY, data.now ?? now)
  return { ok: true, more: data.more === true }
}

/** Forget everything about the sync relationship, on sign-out or on delete. */
export function clearSyncState(): void {
  try {
    window.localStorage.removeItem(MIRROR_KEY)
    window.localStorage.removeItem(CURSOR_KEY)
  } catch {
    // Nothing to do: a stale mirror only costs one redundant upload.
  }
}

/** Subscribe to every synced store at once. */
export function subscribeLibrary(listener: () => void): () => void {
  const unsubscribes = SYNCED_STORES.map(({ key }) =>
    subscribeStore(key, listener)
  )
  return () => unsubscribes.forEach((off) => off())
}
