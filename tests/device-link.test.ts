import { beforeEach, describe, expect, it } from 'vitest'

import {
  DEVICE_LINK_TTL_MS,
  handleDeviceApprove,
  handleDevicePoll,
  handleDeviceStart,
} from '@/lib/auth/device'
import {
  formatUserCode,
  mintUserCode,
  normaliseUserCode,
} from '@/lib/auth/device-code'
import { bearerOf, createSession, loadSession } from '@/lib/auth/session'

import { addUser, sqliteD1 } from './helpers/sqlite-d1'

const post = (body: unknown, cookie?: string) =>
  new Request('https://www.reely.space/api/device/x', {
    method: 'POST',
    headers: cookie ? { Cookie: `reely_session=${cookie}` } : {},
    body: JSON.stringify(body),
  })

describe('device codes', () => {
  it('mints codes that survive the trip through a person', () => {
    const code = mintUserCode(new Uint8Array(8).fill(200))
    expect(code).toHaveLength(8)
    expect(normaliseUserCode(formatUserCode(code).toLowerCase())).toBe(code)
    expect(normaliseUserCode(` ${formatUserCode(code)} `)).toBe(code)
  })

  it('refuses what cannot be a code', () => {
    for (const bad of [
      null,
      7,
      '',
      'BCDF',
      'BCDFGHJKL',
      'OOOOIIII',
      "';--AAAA",
    ]) {
      expect(normaliseUserCode(bad)).toBeNull()
    }
  })
})

describe('bearerOf', () => {
  const withAuth = (value?: string) =>
    new Request('https://x.test', {
      headers: value ? { Authorization: value } : {},
    })

  it('reads a bearer token and nothing else', () => {
    expect(bearerOf(withAuth('Bearer abc'))).toBe('abc')
    expect(bearerOf(withAuth('Basic abc'))).toBeNull()
    expect(bearerOf(withAuth('Bearer '))).toBeNull()
    expect(bearerOf(withAuth())).toBeNull()
  })
})

describe('linking a TV', () => {
  let db: D1Database
  let supporter: string
  let free: string

  const start = async () => {
    const response = await handleDeviceStart(post({}), db)
    return response.json() as Promise<{
      deviceCode: string
      userCode: string
      verifyUrl: string
    }>
  }
  const poll = (deviceCode: string) =>
    handleDevicePoll(post({ deviceCode }), db)

  beforeEach(async () => {
    const opened = sqliteD1('0001_accounts.sql', '0013_device_links.sql')
    const { sqlite } = opened
    db = opened.db
    addUser(sqlite, 'supporter', 'pro')
    addUser(sqlite, 'free', null)
    supporter = await createSession(db, 'supporter', Date.now())
    free = await createSession(db, 'free', Date.now())
  })

  it('pends, then hands over exactly one working session', async () => {
    const { deviceCode, userCode, verifyUrl } = await start()
    expect(verifyUrl).toBe('reely.space/link')
    expect((await (await poll(deviceCode)).json()).status).toBe('pending')

    const approved = await handleDeviceApprove(
      post({ code: userCode }, supporter),
      db
    )
    expect(approved.status).toBe(200)

    const { status, token } = await (await poll(deviceCode)).json()
    expect(status).toBe('approved')
    const user = await loadSession(db, token, Date.now())
    expect(user?.id).toBe('supporter')

    // Collected once: the row is gone, so a replay gets nothing.
    expect((await poll(deviceCode)).status).toBe(410)
  })

  it('refuses a free account, and leaves the code unclaimed', async () => {
    const { deviceCode, userCode } = await start()
    const refused = await handleDeviceApprove(
      post({ code: userCode }, free),
      db
    )
    expect(refused.status).toBe(402)
    expect((await (await poll(deviceCode)).json()).status).toBe('pending')
  })

  it('refuses anyone not signed in', async () => {
    const { userCode } = await start()
    const refused = await handleDeviceApprove(post({ code: userCode }), db)
    expect(refused.status).toBe(401)
  })

  it('will not let a second account claim a claimed code', async () => {
    const { userCode } = await start()
    await handleDeviceApprove(post({ code: userCode }, supporter), db)
    const again = await handleDeviceApprove(
      post({ code: userCode }, supporter),
      db
    )
    expect(again.status).toBe(404)
  })

  it('treats an expired code as gone on both sides', async () => {
    const { deviceCode, userCode } = await start()
    const real = Date.now
    Date.now = () => real() + DEVICE_LINK_TTL_MS + 1
    try {
      const late = await createSession(db, 'supporter', Date.now())
      expect(
        (await handleDeviceApprove(post({ code: userCode }, late), db)).status
      ).toBe(404)
      expect((await poll(deviceCode)).status).toBe(410)
    } finally {
      Date.now = real
    }
  })
})
