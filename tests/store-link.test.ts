import { afterEach, describe, expect, it, vi } from 'vitest'

import { COMPANION_APPS, onStoreLinkClick, openStoreListing } from '@/lib/apps'

const MAC_SAFARI =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'
const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0'
const app = COMPANION_APPS.find(({ slug }) => slug === 'masareef')!

function browser(userAgent: string, open: unknown) {
  const location = { href: '' }
  vi.stubGlobal('window', {
    navigator: { userAgent },
    location,
    open: vi.fn(() => open),
  })
  return location
}

afterEach(() => vi.unstubAllGlobals())

describe('store links on a desktop', () => {
  it.each([MAC_SAFARI, WINDOWS])(
    'leaves the click to the anchor, which no popup blocker can stop: %s',
    (ua) => {
      browser(ua, null)
      const event = { preventDefault: vi.fn() }
      onStoreLinkClick(event, app)
      expect(event.preventDefault).not.toHaveBeenCalled()
      expect(window.open).not.toHaveBeenCalled()
    }
  )

  it('takes over on a phone, to reach the right store', () => {
    browser(IPHONE, {})
    const event = { preventDefault: vi.fn() }
    onStoreLinkClick(event, app)
    expect(event.preventDefault).toHaveBeenCalled()
    expect(window.open).toHaveBeenCalledWith(app.appStoreUrl, '_blank')
  })

  it('a button opens the chooser in a tab that cannot reach back', () => {
    const tab = { opener: 'reely' }
    browser(MAC_SAFARI, tab)
    openStoreListing(app)
    expect(window.open).toHaveBeenCalledWith(app.installUrl, '_blank')
    expect(tab.opener).toBeNull()
  })

  it('a blocked popup falls back to this tab instead of doing nothing', () => {
    const location = browser(MAC_SAFARI, null)
    openStoreListing(app)
    expect(location.href).toBe(app.installUrl)
  })
})
