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
  readPositionMap,
  writePositionMap,
  type PlaybackPosition,
} from '@/lib/playback-positions'
import {
  readStore,
  subscribeStore,
  type WatchedItem,
} from '@/hooks/use-local-storage'

/** localStorage key → the server-side store name. */
// `label` lives here rather than next to the panel that prints it: the account
// page counts one tile per synced store, and a store added without a label
// rendered a card with no number and no words in it. One table, so a new store
// cannot be half-added again.
export const SYNCED_STORES = [
  { key: 'watchlist', store: 'watchlist', label: 'Saved titles' },
  { key: 'watchedItems', store: 'history', label: 'Watch history' },
  { key: 'completedItems', store: 'completed', label: 'Episodes ticked off' },
  { key: 'reviews', store: 'reviews', label: 'Ratings and notes' },
  { key: 'hiddenItems', store: 'hidden', label: 'Titles you hid' },
] as const

const MIRROR_KEY = 'reely_sync_mirror'
const CURSOR_KEY = 'reely_sync_since'

/**
 * The playback-position store, synced as `resume`.
 *
 * Same mirror/diff/tombstone rules as every array store, but the rows come
 * from a MAP (`reely:playback`) rather than an array of WatchedItem, so it is
 * handled beside them with its own read/apply adapters and never appears in
 * SYNCED_STORES — nothing in the app reads positions through that table.
 */
const RESUME_STORE = 'resume'

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
  /**
   * The item itself, or null for a tombstone. Array stores send WatchedItem;
   * the position store sends a PlaybackPosition. The server serialises either.
   */
  payload: WatchedItem | PlaybackPosition | null
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

/**
 * Diff the local position map against the mirror — same rules as
 * `collectChanges`, map-shaped: a key present locally and newer than the
 * mirror is an upload; present in the mirror only (the player cleared it) is
 * a tombstone; an empty mirror on first run suppresses tombstones so signing
 * in on a second device cannot wipe the positions it just pulled.
 *
 * Pure: the caller owns reading and writing the localStorage map.
 */
export function collectResumeChanges(
  positions: Record<string, PlaybackPosition>,
  previous: Record<string, number>,
  now: number
): { changes: OutboundChange[]; current: Record<string, number> } {
  const changes: OutboundChange[] = []
  const current: Record<string, number> = {}
  const firstRun = Object.keys(previous).length === 0

  for (const [key, position] of Object.entries(positions)) {
    const stamp =
      position && typeof position === 'object'
        ? Date.parse(position.updated_at || '')
        : NaN
    if (!Number.isFinite(stamp)) {
      // A row we cannot date is not a deleted row. Carry the mirror's stamp
      // across untouched so this device neither re-sends it nor tombstones
      // what every other device still holds.
      if (previous[key] !== undefined) current[key] = previous[key]
      continue
    }
    current[key] = stamp
    if (previous[key] === undefined || previous[key] < stamp) {
      changes.push({
        store: RESUME_STORE,
        key,
        // The object itself, like every array store sends — the server
        // serialises outbound payloads in one place.
        payload: position,
        updated_at: stamp,
      })
    }
  }

  if (!firstRun) {
    for (const key of Object.keys(previous)) {
      if (current[key] !== undefined) continue
      changes.push({ store: RESUME_STORE, key, payload: null, updated_at: now })
      current[key] = now
    }
  }

  return { changes, current }
}

/**
 * Apply pulled position rows to one map. Last write wins per key, by the
 * row's own stamp; a tombstone removes the entry so "watched to the end" on
 * one device clears it everywhere. Returns the same reference when nothing
 * changed, like `applyChanges`.
 */
export function applyResumeRows(
  map: Record<string, PlaybackPosition>,
  incoming: InboundChange[]
): Record<string, PlaybackPosition> {
  let dirty = false

  for (const change of incoming) {
    if (change.payload === null) {
      if (change.key in map) {
        delete map[change.key]
        dirty = true
      }
      continue
    }
    try {
      const parsed = JSON.parse(change.payload) as PlaybackPosition
      const stamp = Date.parse(parsed.updated_at || '')
      if (
        !Number.isFinite(stamp) ||
        typeof parsed.position_seconds !== 'number'
      ) {
        continue
      }
      const existing = map[change.key]
      if (
        existing &&
        Date.parse(existing.updated_at || '') >= change.updated_at
      ) {
        continue
      }
      map[change.key] = parsed
      dirty = true
    } catch {
      // A corrupt row from an older client. Skipping it beats failing the sync.
    }
  }

  return dirty ? map : { ...map }
}

/** The same two steps against real storage, inside the sync round trip. */
function applyResumeChanges(incoming: InboundChange[]): void {
  if (incoming.length === 0) return
  writePositionMap(applyResumeRows(readPositionMap(), incoming))
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
  inFlightSync = runSync(write)
    .then((result) => {
      notifySyncSettled(result.ok)
      return result
    })
    .finally(() => {
      inFlightSync = null
    })
  return inFlightSync
}

let inFlightSync: Promise<SyncResult> | null = null

/**
 * Fired after every sync attempt settles — success or failure.
 *
 * This is what makes pro data feel live: a surface that reads from the server
 * (the home queue) cannot learn about a change it did not make until the sync
 * that carried it has landed. Anything that needs to re-read after that moment
 * subscribes here rather than guessing at timers.
 */
const settledListeners = new Set<(ok: boolean) => void>()

export function subscribeSyncSettled(
  listener: (ok: boolean) => void
): () => void {
  settledListeners.add(listener)
  return () => {
    settledListeners.delete(listener)
  }
}

function notifySyncSettled(ok: boolean): void {
  for (const listener of [...settledListeners]) {
    try {
      listener(ok)
    } catch {
      // A broken listener must never break the sync it observed.
    }
  }
}

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

  // Positions ride the same round trip on a longer fuse (see
  // use-library-sync's debounce), but they are one diff like everything else.
  const resumeDiff = collectResumeChanges(
    readPositionMap(),
    next[RESUME_STORE] ?? {},
    now
  )
  changes.push(...resumeDiff.changes)
  next[RESUME_STORE] = resumeDiff.current

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

  // The map store applies beside the array ones: same pull, same mirror fold.
  const forResume = inbound.filter((change) => change.store === RESUME_STORE)
  if (forResume.length > 0) {
    applyResumeChanges(forResume)
    const mine = next[RESUME_STORE] ?? {}
    for (const change of forResume) {
      if (change.payload === null) delete mine[change.key]
      else mine[change.key] = change.updated_at
    }
    next[RESUME_STORE] = mine
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

/** Subscribe to every synced store at once. The listener learns WHICH key moved. */
export function subscribeLibrary(listener: (key: string) => void): () => void {
  const unsubscribes = SYNCED_STORES.map(({ key }) =>
    subscribeStore(key, listener)
  )
  return () => unsubscribes.forEach((off) => off())
}
