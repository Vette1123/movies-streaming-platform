import { describe, expect, it } from 'vitest'

import { APPEARANCE_BOOT_SCRIPT } from '@/lib/appearance'

/**
 * The sponsor card is in the static HTML of nearly every page. A supporter must
 * never see it, not even for the frame before React hydrates, so the pre-paint
 * script flags them on <html> and styles/globals.css hides `.sponsor-slot`.
 */
function boot(profile: unknown): Record<string, string> {
  const dataset: Record<string, string> = {}
  const document = { documentElement: { dataset } }
  const localStorage = {
    getItem: () => (profile === undefined ? null : JSON.stringify(profile)),
  }
  new Function('document', 'localStorage', APPEARANCE_BOOT_SCRIPT)(
    document,
    localStorage
  )
  return dataset
}

describe('the pre-paint supporter flag', () => {
  it('flags a cached supporter before the first paint', () => {
    expect(boot({ pro: true }).pro).toBe('1')
  })

  it('leaves everyone else unflagged, so their card paints', () => {
    expect(boot({ pro: false }).pro).toBeUndefined()
    expect(boot(undefined).pro).toBeUndefined()
  })
})
