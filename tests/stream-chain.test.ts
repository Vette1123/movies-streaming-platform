import { embeddedHosts, wrappedSlots } from '@/scripts/lib/stream-chain.mjs'
import { describe, expect, it } from 'vitest'

/**
 * 2026-11-11: server 1's player host went down, and the one automatic hop
 * after a stall went to server 2 — whose embed page is nothing but an iframe
 * of server 1. Every rescue landed on the same dead player. These pin the
 * check that catches a slot wrapping an earlier one.
 */

// Shapes seen in the wild (hosts are placeholders; the repo names none).
const WRAPPER =
  '<html><body><iframe src="https://one.example/embed/movie/550/" allowfullscreen></iframe></body></html>'
const LAZY =
  '<iframe id="iframesrc" src="about:blank" data-src="https://three.example/embed/movie/550"></iframe>'
const OWN_PLAYER =
  '<html><script src="/player.js"></script><div id="player"></div></html>'

describe('embeddedHosts', () => {
  it('reads an iframe src', () => {
    expect(embeddedHosts(WRAPPER)).toEqual(['one.example'])
  })

  it('reads a lazy data-src and skips about:blank', () => {
    expect(embeddedHosts(LAZY)).toEqual(['three.example'])
  })

  it('is empty for a page that is its own player', () => {
    expect(embeddedHosts(OWN_PLAYER)).toEqual([])
  })
})

describe('wrappedSlots', () => {
  const slots = [
    { slot: 1, host: 'one.example', embeds: [] },
    { slot: 2, host: 'two.example', embeds: ['one.example'] },
    { slot: 3, host: 'four.example', embeds: ['three.example'] },
  ]

  it('names a slot whose embed is an earlier slot', () => {
    expect(wrappedSlots(slots)).toEqual([{ slot: 2, wraps: 1 }])
  })

  it('passes when no slot wraps another configured slot', () => {
    expect(wrappedSlots([slots[0], slots[2]])).toEqual([])
  })

  it('matches www and bare hosts as the same server', () => {
    const www = [
      { slot: 1, host: 'www.one.example', embeds: [] },
      { slot: 2, host: 'two.example', embeds: ['one.example'] },
    ]
    expect(wrappedSlots(www)).toEqual([{ slot: 2, wraps: 1 }])
  })
})
