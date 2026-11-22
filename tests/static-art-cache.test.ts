import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const headers = readFileSync('public/_headers', 'utf8').replace(/\r\n/g, '\n')

// The cross-promo icons and art sent `max-age=0, must-revalidate`, the asset
// default, so every page view re-asked for each one. They are unhashed (an app
// redraws its icon), so a week, not a year.
describe('cross-promo art caching', () => {
  it.each(['/apps/*', '/promo/*'])('%s keeps a week in the browser', (path) => {
    expect(headers).toContain(
      `${path}\n  Cache-Control: public, max-age=604800, stale-while-revalidate=604800`
    )
  })
})
