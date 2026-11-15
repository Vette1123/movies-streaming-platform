import { afterEach, describe, expect, it, vi } from 'vitest'

import { copyText } from '@/lib/copy-text'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('copyText', () => {
  it('is true only once the clipboard accepted the text', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    await expect(copyText('hello')).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledWith('hello')
  })

  it('is false when the clipboard refuses and there is no fallback', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    })
    await expect(copyText('hello')).resolves.toBe(false)
  })

  it('is false when the Clipboard API is missing (http, webview)', async () => {
    vi.stubGlobal('navigator', {})
    await expect(copyText('hello')).resolves.toBe(false)
  })

  it('never claims to copy an empty string', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    await expect(copyText('')).resolves.toBe(false)
    expect(writeText).not.toHaveBeenCalled()
  })
})
