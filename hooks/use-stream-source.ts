'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  DEFAULT_SOURCE_ID,
  RICH_SOURCE,
  visibleSourcesFor,
  type StreamSource,
} from '@/config/sources'
import { savePrefs } from '@/lib/account'
import { useAccountIdentity } from '@/hooks/use-account'

/**
 * Which provider plays this title, and how to move off one that will not.
 *
 * Switching requires a signed-in account. Within that:
 *
 *  1. **What worked for THIS title.** Providers differ per title far more than
 *     they differ overall — one carries a show the other has never had — so the
 *     memory that actually saves time is per title, and it is written the moment
 *     somebody switches rather than asked for.
 *  2. **This device's provider**, in localStorage, for every other title.
 *  3. **The tier's default underneath**: our own player for supporters, the
 *     environment's default embed for everyone else.
 *
 * The supporter difference is the DEFAULT, not a locked door: free accounts
 * switch freely between the embed servers; supporters start on ours.
 */
const BY_TITLE_KEY = 'reely_stream_source_by_title'
const DEVICE_KEY = 'reely_stream_source'

type ByTitle = Record<string, string>

/** Bounded so a long history of one-off switches cannot fill storage. */
const MAX_REMEMBERED = 300

const readJson = <T>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

const writeJson = (key: string, value: unknown): void => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage full or denied. A forgotten preference costs one extra click on
    // the next visit; there is nothing here worth failing playback over.
  }
}

/**
 * Drop the oldest entries once the map is over the cap.
 *
 * Insertion order is the record's own history — objects preserve it for string
 * keys that are not array indices, and every key here is `movie:550`. So the
 * head of the list is the least recently added, which is the right thing to
 * forget.
 */
function trim(map: ByTitle): ByTitle {
  const keys = Object.keys(map)
  if (keys.length <= MAX_REMEMBERED) return map
  const out: ByTitle = {}
  for (const key of keys.slice(keys.length - MAX_REMEMBERED))
    out[key] = map[key]
  return out
}

/** The next server along, or null on the last one. */
function sourceAfter(
  sources: StreamSource[],
  currentId: string
): StreamSource | null {
  const index = sources.findIndex((entry) => entry.id === currentId)
  if (index < 0) return null
  return sources[index + 1] ?? null
}

export interface StreamSourceControl {
  /** What to play from right now. */
  source: StreamSource
  sources: StreamSource[]
  /** Switch, and remember the choice for this title. */
  select: (id: string) => void
  /** The next provider in the list, or null when this is the last one. */
  next: StreamSource | null
  /** Move to `next`. A no-op on the last provider. */
  advance: () => void
  /** True once a switch has happened, so the UI can explain itself. */
  switched: boolean
  /**
   * Whether this visitor has more than one server to choose between.
   *
   * Requires a signed-in account — choice is an account feature, so anonymous
   * visitors always get exactly the default server, on the same URL, with the
   * same behaviour as always. The gate is enforced HERE rather than in the
   * component: a control that renders nothing but still answers `next` would
   * let a caller hop servers with no UI to show for it.
   */
  canSwitch: boolean
}

export function useStreamSource(mediaKey: string): StreamSourceControl {
  // The cache-backed identity, not the raw store: a supporter arriving on a cold
  // page is `pro: false` for as long as the account refresh takes, and the cost
  // of that gap here is the player silently pinning them to the default server
  // for the title they just opened. Same reason the header paints from it.
  const { signedIn, pro } = useAccountIdentity()
  const [devicePreference, setDevicePreference] = useState('')
  const [byTitle, setByTitle] = useState<ByTitle>({})
  const [switched, setSwitched] = useState(false)

  useEffect(() => {
    // localStorage has no server answer, so the first client pass is the
    // earliest anything can read it — the same shape as use-mounted. Read
    // directly rather than through use-local-storage, which is typed to the
    // library's item arrays and broadcasts every write to the sync engine.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setByTitle(readJson<ByTitle>(BY_TITLE_KEY, {}))
    setDevicePreference(readJson<string>(DEVICE_KEY, ''))
  }, [])

  /**
   * The servers THIS visitor may choose between. Switching costs an account:
   * anonymous visitors always get the single default server. Supporters
   * additionally get our own player as their AUTOMATIC default — a fresh
   * title opens in it with no toggle needed.
   */
  const sources = useMemo(
    () => visibleSourcesFor(signedIn === true, pro === true),
    [signedIn, pro]
  )

  const canSwitch = signedIn === true && sources.length > 1

  const currentId = useMemo(() => {
    // Per-title memory first, for every tier: it is written only by an
    // explicit switch on that title, so it is always the most recent intent.
    const remembered = byTitle[mediaKey]
    if (remembered && sources.some((s) => s.id === remembered)) {
      return remembered
    }
    if (!pro) {
      if (devicePreference && sources.some((s) => s.id === devicePreference))
        return devicePreference
      return DEFAULT_SOURCE_ID
    }
    // Supporters: the self-host player IS the default. Stored account/device
    // server choices predate it, so honouring them here would silently pin
    // supporters to an embed; a deliberate switch writes per-title memory,
    // which is honoured above.
    if (RICH_SOURCE) return RICH_SOURCE.id
    return DEFAULT_SOURCE_ID
  }, [byTitle, devicePreference, mediaKey, pro, sources])

  // Resolve within the visitor's own list; an id that is not in it (a source
  // remembered before opting out) falls to the site default.
  const source = sources.find((entry) => entry.id === currentId) ?? sources[0]

  const select = useCallback(
    (id: string) => {
      if (!canSwitch) return
      if (!sources.some((entry) => entry.id === id)) return
      setSwitched(true)
      // Computed from the state this render already holds rather than inside the
      // updater: an updater has to be pure, and React may run it twice.
      const merged = trim({ ...byTitle, [mediaKey]: id })
      setByTitle(merged)
      writeJson(BY_TITLE_KEY, merged)
      // Also the device default, so somebody who had to switch once does not
      // have to switch again on the next title. The per-title memory still wins
      // for the titles that needed something else.
      setDevicePreference(id)
      writeJson(DEVICE_KEY, id)
      // And onto the account, which is what carries it to the other devices.
      // Fire-and-forget: a failed write costs a preference, and blocking the
      // switch on a round trip would leave somebody staring at a dead frame
      // while the network decides.
      void savePrefs({ source: id })
    },
    [byTitle, canSwitch, mediaKey, sources]
  )

  const next = canSwitch ? sourceAfter(sources, source.id) : null

  const advance = useCallback(() => {
    if (next) select(next.id)
  }, [next, select])

  return {
    source,
    // One entry for everyone else, so a caller that maps over this cannot paint
    // a chooser with nothing to choose. Opted-in supporters see the rich
    // surface first, then every fallback server.
    sources: canSwitch ? sources : sources.slice(0, 1),
    select,
    next,
    advance,
    switched,
    canSwitch,
  }
}
