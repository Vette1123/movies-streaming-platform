import { describe, expect, it } from 'vitest'

import { signEntryTicket } from '@/lib/pro/playback-ticket'

// The main worker mints these; the private player worker verifies with the
// same secret and format (reely-pro-player/src/tokens.mjs is the other half).
// A mismatch here strands every playback behind 401s, so the contract —
// base64url framing, compact field names, seconds precision — is pinned here.

// Secrets are shared with the player worker as base64url bytes
// (`openssl rand -base64 | tr '+/' '-_'`), so test with that shape.
const SECRET = 'dGVzdC1zZWNyZXQ' // base64url("test-secret")
const SECRET_BYTES = new TextEncoder().encode('test-secret')

const decodePayload = (ticket: string): Record<string, unknown> =>
  JSON.parse(Buffer.from(ticket.split('.')[0], 'base64url').toString('utf8'))

describe('signEntryTicket', () => {
  it('produces two base64url segments: payload and signature', async () => {
    const ticket = await signEntryTicket(SECRET, { type: 'movie', id: 550 })
    expect(ticket).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)
  })

  it('returns null when no secret is configured', async () => {
    expect(await signEntryTicket(undefined, { type: 'movie', id: 550 })).toBeNull()
    expect(await signEntryTicket('', { type: 'movie', id: 550 })).toBeNull()
  })

  it('carries the compact identity fields', async () => {
    const data = decodePayload(
      (await signEntryTicket(SECRET, { type: 'movie', id: 550 })) as string
    )
    expect(data.k).toBe('t')
    expect(data.ty).toBe('movie')
    expect(data.id).toBe(550)
    expect(data.s).toBeUndefined()
    expect(data.ep).toBeUndefined()
  })

  it('serializes tv season and episode with defaults of 1', async () => {
    const data = decodePayload(
      (await signEntryTicket(SECRET, {
        type: 'tv',
        id: 1399,
        season: 2,
        episode: 7,
      })) as string
    )
    expect(data.ty).toBe('tv')
    expect(data.s).toBe(2)
    expect(data.ep).toBe(7)

    const defaulted = decodePayload(
      (await signEntryTicket(SECRET, { type: 'tv', id: 1399 })) as string
    )
    expect(defaulted.s).toBe(1)
    expect(defaulted.ep).toBe(1)
  })

  it('expires ~90 seconds out', async () => {
    const before = Math.floor(Date.now() / 1000)
    const data = decodePayload(
      (await signEntryTicket(SECRET, { type: 'movie', id: 550 })) as string
    )
    expect((data.exp as number) - before).toBeGreaterThanOrEqual(85)
    expect((data.exp as number) - before).toBeLessThanOrEqual(95)
  })

  it('signs HMAC-SHA256 over exactly the payload segment', async () => {
    const ticket = (await signEntryTicket(SECRET, {
      type: 'movie',
      id: 550,
    })) as string
    const [body, sig] = ticket.split('.')
    const key = await crypto.subtle.importKey(
      'raw',
      SECRET_BYTES,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const mac = await crypto.subtle.sign(
      'HMAC',
      key,
      new TextEncoder().encode(body)
    )
    const expected = Buffer.from(mac)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
    expect(sig).toBe(expected)
  })
})
