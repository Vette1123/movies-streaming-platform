import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'

import {
  CHUNK_SIZE,
  fileKindFor,
  firstChunkFor,
  lastChunkFor,
  LIBRARY_TOKEN_TTL_S,
  mediaKey,
  mediaPrefix,
  parseMediaKey,
  parseRange,
  safeRelPath,
  signLibraryToken,
  verifyLibraryToken,
  verifyPlayToken,
} from '@/lib/library-mode'

// Own-library mode's serving contracts. Every pin here is something a hostile
// or merely changed caller could get wrong in a way that costs bytes, quota
// or a traversal: the key shapes, the path guard, the Range math the segment
// requests ride on, and the two token kinds sharing one secret.

// base64url("test-secret") — the shape real secrets are set in.
const SECRET = 'dGVzdC1zZWNyZXQ'
// Real epoch seconds: tokens are signed against the system clock, so a fixed
// far-future NOW would reject everything as expired.
const NOW = Math.floor(Date.now() / 1000)

const decodePayload = (token: string): Record<string, unknown> =>
  JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString('utf8'))

/** A play token built the way reely-pro-player/src/tokens.mjs builds them. */
const playerShapedPlayToken = (secret: string, exp: number): string => {
  const body = JSON.stringify({ k: 'p', ty: 'movie', id: 550, exp })
  const json = Buffer.from(body, 'utf8').toString('base64url')
  // The secret travels as base64url bytes; the player decodes it before use.
  const raw = Buffer.from(
    secret.replace(/-/g, '+').replace(/_/g, '/'),
    'base64'
  )
  return `${json}.${createHmac('sha256', raw).update(json).digest('base64url')}`
}

describe('mediaKey', () => {
  it('names a movie, and a TV episode with defaults filled in', () => {
    expect(mediaKey({ ty: 'movie', id: 550 })).toBe('movie:550')
    expect(mediaKey({ ty: 'tv', id: 1399 })).toBe('tv:1399:1:1')
    expect(mediaKey({ ty: 'tv', id: 1399, s: 2, ep: 7 })).toBe('tv:1399:2:7')
  })

  it('refuses shapes that would build a half key', () => {
    expect(mediaKey({ ty: 'show', id: 550 })).toBeNull()
    expect(mediaKey({ ty: 'movie', id: 0 })).toBeNull()
    expect(mediaKey({ ty: 'movie', id: 1.5 })).toBeNull()
    expect(mediaKey({ ty: 'movie', id: Number.NaN })).toBeNull()
    expect(mediaKey({ ty: 'movie', id: '550' })).toBeNull()
    expect(mediaKey({ ty: 'tv', id: 1399, s: 0, ep: 1 })).toBeNull()
    expect(mediaKey({})).toBeNull()
  })

  it('parses back what it built', () => {
    expect(parseMediaKey('movie:550')).toEqual({ ty: 'movie', id: 550 })
    expect(parseMediaKey('tv:1399:2:7')).toEqual({
      ty: 'tv',
      id: 1399,
      s: 2,
      ep: 7,
    })
    expect(parseMediaKey('tv:1399')).toBeNull()
    expect(parseMediaKey('movie:550/extra')).toBeNull()
    expect(parseMediaKey(undefined)).toBeNull()
  })

  it('gives every unit its own storage prefix, with no overlap', () => {
    expect(mediaPrefix('movie:550')).toBe('movie/550')
    expect(mediaPrefix('tv:1399:2:7')).toBe('tv/1399/2-7')
    // The prefix ends before a slash, so deleting 'movie/550/%' can never
    // touch 'movie:5501'.
    const a = mediaPrefix('movie:550')
    const b = mediaPrefix('movie:5501')
    expect(a === null || b === null || `${a}/`.startsWith(b)).toBe(false)
  })
})

describe('safeRelPath', () => {
  it('accepts plain tree-internal paths', () => {
    expect(safeRelPath('master.m3u8')).toBe('master.m3u8')
    expect(safeRelPath('1080p/index.m3u8')).toBe('1080p/index.m3u8')
    expect(safeRelPath('seg0001.ts')).toBe('seg0001.ts')
  })

  it('refuses every way out of the tree', () => {
    expect(safeRelPath('../secret')).toBeNull()
    expect(safeRelPath('a/../../b')).toBeNull()
    expect(safeRelPath('a/..')).toBeNull()
    expect(safeRelPath('.')).toBeNull()
    expect(safeRelPath('/etc/passwd')).toBeNull()
    expect(safeRelPath('a\\b')).toBeNull()
    expect(safeRelPath('%2e%2e/secret')).toBeNull()
    expect(safeRelPath('a//b')).toBeNull()
    expect(safeRelPath('')).toBeNull()
    expect(safeRelPath('a/b/c/d/e')).toBeNull()
    expect(safeRelPath('x'.repeat(257))).toBeNull()
  })
})

describe('parseRange', () => {
  it('serves the whole file when there is nothing to clip', () => {
    expect(parseRange(null, 1000)).toBeNull()
    expect(parseRange('bytes=0-1,3-4', 1000)).toBeNull()
    expect(parseRange('nonsense', 1000)).toBeNull()
    expect(parseRange('bytes=-', 1000)).toBeNull()
  })

  it('parses the three single-range forms', () => {
    expect(parseRange('bytes=0-499', 1000)).toEqual({ start: 0, end: 499 })
    expect(parseRange('bytes=500-', 1000)).toEqual({ start: 500, end: 999 })
    expect(parseRange('bytes=-500', 1000)).toEqual({ start: 500, end: 999 })
  })

  it('clamps an over-long end and answers impossible starts', () => {
    expect(parseRange('bytes=0-9999', 1000)).toEqual({ start: 0, end: 999 })
    expect(parseRange('bytes=1000-', 1000)).toBe('invalid')
    expect(parseRange('bytes=-0', 1000)).toBeNull()
  })

  it('survives a zero-length file', () => {
    expect(parseRange('bytes=0-', 0)).toBe('invalid')
  })
})

describe('chunk math', () => {
  it('splits files on exact chunk boundaries', () => {
    expect(firstChunkFor(0)).toBe(0)
    expect(firstChunkFor(CHUNK_SIZE - 1)).toBe(0)
    expect(firstChunkFor(CHUNK_SIZE)).toBe(1)
    expect(lastChunkFor(0)).toBe(0)
    expect(lastChunkFor(CHUNK_SIZE)).toBe(0)
    expect(lastChunkFor(CHUNK_SIZE + 1)).toBe(1)
    // A 2.5-chunk file: byte CHUNK_SIZE*2+5 is in chunk 2 of 0..2.
    const size = CHUNK_SIZE * 2 + 5
    expect([firstChunkFor(size - 1), lastChunkFor(size)]).toEqual([2, 2])
  })
})

describe('tokens', () => {
  it('round-trips a library token', async () => {
    const token = await signLibraryToken(
      SECRET,
      { ty: 'tv', id: 1399, s: 2, ep: 7 },
      600
    )
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)
    const claims = await verifyLibraryToken(SECRET, token, NOW)
    expect(claims).toEqual({
      k: 'l',
      ty: 'tv',
      id: 1399,
      s: 2,
      ep: 7,
      exp: NOW + 600,
    })
  })

  it('defaults the TTL to the player play token length', async () => {
    const claims = await verifyLibraryToken(
      SECRET,
      await signLibraryToken(SECRET, { ty: 'movie', id: 550 }),
      NOW
    )
    // ±1s: the sign call stamps its own second.
    expect(claims?.exp).toBeGreaterThanOrEqual(NOW - 1 + LIBRARY_TOKEN_TTL_S)
    expect(claims?.exp).toBeLessThanOrEqual(NOW + 1 + LIBRARY_TOKEN_TTL_S)
  })

  it('refuses the wrong secret, tampered payloads and expiry', async () => {
    const token = (await signLibraryToken(SECRET, {
      ty: 'movie',
      id: 550,
    })) as string
    expect(
      await verifyLibraryToken('dGhlLXdyb25nLXNlY3JldA', token, NOW)
    ).toBeNull()
    const parts = token.split('.')
    const body = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'))
    body.id = 551
    const evil = `${Buffer.from(JSON.stringify(body), 'utf8').toString('base64url')}.${parts[1]}`
    expect(await verifyLibraryToken(SECRET, evil, NOW)).toBeNull()
    const expired = await signLibraryToken(SECRET, { ty: 'movie', id: 550 }, -1)
    expect(await verifyLibraryToken(SECRET, expired, NOW)).toBeNull()
  })

  it('keeps the two token kinds apart', async () => {
    const lib = (await signLibraryToken(SECRET, {
      ty: 'movie',
      id: 550,
    })) as string
    // A play token opens a play-route check, never an HLS URL, and the reverse.
    expect(
      await verifyLibraryToken(
        SECRET,
        playerShapedPlayToken(SECRET, NOW + 60),
        NOW
      )
    ).toBeNull()
    expect(await verifyPlayToken(SECRET, lib, NOW)).toBeNull()
  })

  it('verifies a token shaped exactly like the player worker mints them', async () => {
    const claims = await verifyPlayToken(
      SECRET,
      playerShapedPlayToken(SECRET, NOW + 60),
      NOW
    )
    expect(claims).toMatchObject({ k: 'p', ty: 'movie', id: 550 })
    expect(
      await verifyPlayToken(SECRET, playerShapedPlayToken(SECRET, NOW - 1), NOW)
    ).toBeNull()
  })
})

describe('file kinds', () => {
  it('classifies the HLS tree', () => {
    expect(fileKindFor('master.m3u8')).toBe('playlist')
    expect(fileKindFor('1080p/index.m3u8')).toBe('playlist')
    expect(fileKindFor('seg0001.ts')).toBe('segment')
    expect(fileKindFor('init.mp4')).toBe('segment')
    expect(fileKindFor('cover.jpg')).toBe('other')
  })
})
