import { describe, expect, it } from 'vitest'

import {
  applyChanges,
  collectChanges,
  itemKey,
  SYNCED_STORES,
} from '@/lib/library-sync'
import { normaliseChanges } from '@/lib/sync/routes'
import type { WatchedItem } from '@/hooks/use-local-storage'

const NOW = Date.parse('2026-08-15T12:00:00Z')

const item = (over: Partial<WatchedItem> = {}): WatchedItem =>
  ({
    id: 1399,
    type: 'series',
    title: 'Game of Thrones',
    added_at: new Date(NOW - 1000).toISOString(),
    modified_at: new Date(NOW - 1000).toISOString(),
    ...over,
  }) as WatchedItem

describe('normaliseChanges (server side)', () => {
  it('clamps a client clock running fast', () => {
    const [change] = normaliseChanges(
      [
        {
          store: 'watchlist',
          key: 'series:1399',
          payload: { id: 1399 },
          updated_at: NOW + 3 * 60 * 60 * 1000,
        },
      ],
      NOW
    )
    // Otherwise a device three hours ahead pins its version of every item as
    // permanently newest and no other device can ever win again.
    expect(change.updated_at).toBe(NOW)
  })

  it('serialises an object payload and keeps a string one', () => {
    const [fromObject] = normaliseChanges(
      [
        {
          store: 'history',
          key: 'movie:1',
          payload: { id: 1 },
          updated_at: NOW,
        },
      ],
      NOW
    )
    expect(fromObject.payload).toBe('{"id":1}')

    const [fromString] = normaliseChanges(
      [
        {
          store: 'history',
          key: 'movie:1',
          payload: '{"id":1}',
          updated_at: NOW,
        },
      ],
      NOW
    )
    expect(fromString.payload).toBe('{"id":1}')
  })

  it('keeps a null payload as a tombstone', () => {
    const [change] = normaliseChanges(
      [
        {
          store: 'completed',
          key: 'series:1:1:1',
          payload: null,
          updated_at: NOW,
        },
      ],
      NOW
    )
    expect(change.payload).toBeNull()
  })

  it('drops everything malformed rather than failing the batch', () => {
    const changes = normaliseChanges(
      [
        null,
        'nope',
        { store: 'not-a-store', key: 'k', updated_at: NOW },
        { store: 'watchlist', key: '', updated_at: NOW },
        { store: 'watchlist', key: 'x'.repeat(65), updated_at: NOW },
        { store: 'watchlist', key: 'k', updated_at: 'soon' },
        { store: 'watchlist', key: 'k', updated_at: 0 },
        {
          store: 'watchlist',
          key: 'k',
          payload: 'x'.repeat(5000),
          updated_at: NOW,
        },
        // The one good row.
        { store: 'watchlist', key: 'movie:1', payload: null, updated_at: NOW },
      ],
      NOW
    )
    expect(changes).toHaveLength(1)
    expect(changes[0].key).toBe('movie:1')
  })

  it('caps a batch at 500 rather than accepting an unbounded one', () => {
    const many = Array.from({ length: 900 }, (_, i) => ({
      store: 'watchlist',
      key: `movie:${i}`,
      payload: null,
      updated_at: NOW,
    }))
    expect(normaliseChanges(many, NOW)).toHaveLength(500)
  })

  it('returns nothing for input that is not an array', () => {
    expect(normaliseChanges(null, NOW)).toEqual([])
    expect(normaliseChanges({ store: 'watchlist' }, NOW)).toEqual([])
  })
})

describe('collectChanges (client side)', () => {
  const stores = SYNCED_STORES as unknown as { key: string; store: string }[]
  const read = (contents: Record<string, WatchedItem[]>) => (key: string) =>
    contents[key] ?? []

  it('sends everything on a first run and NO tombstones', () => {
    const { changes, next } = collectChanges(
      stores,
      read({ watchlist: [item()] }),
      {},
      NOW
    )
    expect(changes).toHaveLength(1)
    expect(changes[0]).toMatchObject({ store: 'watchlist', key: 'series:1399' })
    // The rule that makes signing in on a second device safe: an empty mirror
    // means "never uploaded", not "everything was deleted".
    expect(changes.some((change) => change.payload === null)).toBe(false)
    expect(next.watchlist['series:1399']).toBeDefined()
  })

  it('sends nothing when nothing changed', () => {
    const saved = item()
    const mirror = {
      watchlist: { [itemKey(saved)]: Date.parse(saved.modified_at!) },
    }
    const { changes } = collectChanges(
      stores,
      read({ watchlist: [saved] }),
      mirror,
      NOW
    )
    expect(changes).toEqual([])
  })

  it('sends a tombstone once a mirror exists', () => {
    const mirror = { watchlist: { 'series:1399': NOW - 5000 } }
    const { changes, next } = collectChanges(stores, read({}), mirror, NOW)
    expect(changes).toEqual([
      {
        store: 'watchlist',
        key: 'series:1399',
        payload: null,
        updated_at: NOW,
      },
    ])
    // Remembered, so it is sent once rather than forever.
    expect(next.watchlist['series:1399']).toBe(NOW)
  })
})

describe('applyChanges', () => {
  const existing = item({ modified_at: new Date(NOW).toISOString() })

  it('returns the SAME array reference when nothing came back, so nothing re-renders', () => {
    const items = [existing]
    expect(applyChanges(items, [])).toBe(items)
    expect(
      applyChanges(items, [
        // Older than what is held: applied to nothing, so still no new array.
        {
          store: 'watchlist',
          key: itemKey(existing),
          payload: JSON.stringify(existing),
          updated_at: NOW - 1,
        },
      ])
    ).toBe(items)
  })

  it('adds an item the server has and this device does not', () => {
    const incoming = [
      {
        store: 'watchlist',
        key: 'movie:550',
        payload: JSON.stringify(
          item({ id: 550, type: 'movie', title: 'Fight Club' })
        ),
        updated_at: NOW,
      },
    ]
    const merged = applyChanges([], incoming)
    expect(merged).toHaveLength(1)
    expect(merged[0].id).toBe(550)
  })

  it('keeps the newer of the two versions', () => {
    const older = JSON.stringify(
      item({
        title: 'Stale',
        modified_at: new Date(NOW - 60_000).toISOString(),
      })
    )
    const merged = applyChanges(
      [existing],
      [
        {
          store: 'watchlist',
          key: itemKey(existing),
          payload: older,
          updated_at: NOW - 60_000,
        },
      ]
    )
    expect(merged[0].title).toBe(existing.title)
  })

  it('applies a tombstone', () => {
    const merged = applyChanges(
      [existing],
      [
        {
          store: 'watchlist',
          key: itemKey(existing),
          payload: null,
          updated_at: NOW + 1,
        },
      ]
    )
    expect(merged).toEqual([])
  })

  it('drops a row whose key disagrees with its payload', () => {
    const merged = applyChanges(
      [],
      [
        {
          store: 'watchlist',
          key: 'movie:999',
          payload: JSON.stringify(item()),
          updated_at: NOW,
        },
      ]
    )
    expect(merged).toEqual([])
  })

  it('survives a corrupt row without losing the rest of the batch', () => {
    const merged = applyChanges(
      [],
      [
        {
          store: 'watchlist',
          key: 'movie:1',
          payload: '{not json',
          updated_at: NOW,
        },
        {
          store: 'watchlist',
          key: 'movie:550',
          payload: JSON.stringify(item({ id: 550, type: 'movie' })),
          updated_at: NOW,
        },
      ]
    )
    expect(merged).toHaveLength(1)
  })
})

describe('itemKey', () => {
  it('is the title for a title and the episode for an episode', () => {
    expect(itemKey(item())).toBe('series:1399')
    expect(itemKey(item({ season: 2, episode: 5 }))).toBe('series:1399:2:5')
  })
})
