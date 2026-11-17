import { NOT_FLEET } from '@/scripts/lib/posthog.mjs'
import { describe, expect, it } from 'vitest'

import {
  isShanghaiDesktopFleet,
  isSquareScreenFleet,
  landedOnErrorPage,
  SQUARE_FLEET_RATIO,
} from '@/lib/posthog-client'

const WIN_CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36'
const LINUX_CHROME =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36'
const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36'
const MAC_SAFARI =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15'

const fleet = {
  ua: WIN_CHROME,
  timeZone: 'Asia/Shanghai',
  language: 'zh-CN',
  screenWidth: 1920,
  screenHeight: 1080,
}

describe('isShanghaiDesktopFleet', () => {
  it('catches the measured fleet: Windows 1920x1080 and Linux 1440x900', () => {
    expect(isShanghaiDesktopFleet(fleet)).toBe(true)
    expect(
      isShanghaiDesktopFleet({
        ...fleet,
        ua: LINUX_CHROME,
        screenWidth: 1440,
        screenHeight: 900,
      })
    ).toBe(true)
  })

  it('keeps a Chinese visitor on any other screen size', () => {
    expect(
      isShanghaiDesktopFleet({
        ...fleet,
        screenWidth: 2560,
        screenHeight: 1440,
      })
    ).toBe(false)
  })

  it('keeps phones and non-Chrome browsers', () => {
    expect(isShanghaiDesktopFleet({ ...fleet, ua: ANDROID_CHROME })).toBe(false)
    expect(isShanghaiDesktopFleet({ ...fleet, ua: MAC_SAFARI })).toBe(false)
  })

  it('needs both the timezone and the language', () => {
    expect(
      isShanghaiDesktopFleet({ ...fleet, timeZone: 'Europe/London' })
    ).toBe(false)
    expect(isShanghaiDesktopFleet({ ...fleet, language: 'en-US' })).toBe(false)
  })
})

describe('isSquareScreenFleet', () => {
  it('catches the randomised near-square desktop screens', () => {
    for (const [w, h] of [
      [1305, 1162],
      [1302, 1200],
      [1340, 1245],
      [1268, 1106],
      // 2026-11: the same farm moved just past square
      [1166, 1247],
      [1204, 1359],
      [1074, 1244],
      [1280, 1280],
    ]) {
      expect(
        isSquareScreenFleet({ ua: WIN_CHROME, screenWidth: w, screenHeight: h })
      ).toBe(true)
    }
  })

  it('keeps every real desktop shape, and every phone', () => {
    for (const [w, h] of [
      [1920, 1080], // 16:9
      [1440, 900], // 16:10
      [1024, 768], // 4:3
      [1280, 1024], // 5:4, exactly 0.80
      [1080, 1920], // portrait monitor
      [1024, 1280], // 5:4 portrait, exactly 1.25
      [834, 1194], // tablet-sized desktop window, 1.43
    ]) {
      expect(
        isSquareScreenFleet({ ua: WIN_CHROME, screenWidth: w, screenHeight: h })
      ).toBe(false)
    }
    expect(
      isSquareScreenFleet({
        ua: ANDROID_CHROME,
        screenWidth: 412,
        screenHeight: 390,
      })
    ).toBe(false)
    expect(
      isSquareScreenFleet({ ua: MAC_SAFARI, screenWidth: 0, screenHeight: 0 })
    ).toBe(false)
  })
})

describe('NOT_FLEET', () => {
  it('drops history with the same band the client gate drops live', () => {
    const { min, max } = SQUARE_FLEET_RATIO
    expect(NOT_FLEET).toContain(`BETWEEN ${min} AND ${max})`)
  })
})

// 2026-11-17: 285 "people" in 9 hours, each landing on one random
// /movies/<id> that 404s, 1920x1080 Chrome, direct, gone in a second, never a
// click. Analytics waits for a press when the landing answered an error.
describe('landedOnErrorPage', () => {
  it('is true when the landing document answered 4xx or 5xx', () => {
    expect(landedOnErrorPage({ responseStatus: 404 })).toBe(true)
    expect(landedOnErrorPage({ responseStatus: 500 })).toBe(true)
  })

  it('is false for a normal landing, and where the browser cannot say', () => {
    expect(landedOnErrorPage({ responseStatus: 200 })).toBe(false)
    // Safari has no responseStatus; 0 is a cross-origin or cached answer.
    // Neither withholds analytics.
    expect(landedOnErrorPage({ responseStatus: 0 })).toBe(false)
    expect(landedOnErrorPage({})).toBe(false)
    expect(landedOnErrorPage(undefined)).toBe(false)
  })
})
