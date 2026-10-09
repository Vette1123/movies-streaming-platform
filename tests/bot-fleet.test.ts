import { describe, expect, it } from 'vitest'

import { isShanghaiDesktopFleet } from '@/lib/posthog-client'

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
