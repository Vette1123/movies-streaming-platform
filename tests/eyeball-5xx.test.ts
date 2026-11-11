import { eyeball5xxGrade } from '@/scripts/lib/eyeball-5xx.mjs'
import { describe, expect, it } from 'vitest'

/**
 * The 5xx gate failed on 1×503 of 179,363 requests (2026-11-11). A gate that
 * goes red on noise teaches its reader to skip it, and then it misses the
 * outage it exists for. These pin both directions.
 */
describe('eyeball5xxGrade', () => {
  it('passes a clean window', () => {
    expect(eyeball5xxGrade(0, 179_363)).toBe(true)
  })

  it('warns, not fails, on a stray 5xx in a day of traffic', () => {
    expect(eyeball5xxGrade(1, 179_363)).toBe('warn')
  })

  it('warns on a single 5xx in a short, low-traffic window', () => {
    // `pnpm cf:health 1` at night: one blip is 0.2% of 500 requests.
    expect(eyeball5xxGrade(1, 500)).toBe('warn')
  })

  it('fails a minute of real outage on a normal day', () => {
    // ~125 requests a minute; a minute down is far past 0.05%.
    expect(eyeball5xxGrade(125, 179_363)).toBe(false)
  })

  it('fails a sustained failure in a short window', () => {
    expect(eyeball5xxGrade(40, 500)).toBe(false)
  })

  it('fails when every request failed', () => {
    expect(eyeball5xxGrade(20, 20)).toBe(false)
  })

  it('passes an empty window rather than dividing by zero', () => {
    expect(eyeball5xxGrade(0, 0)).toBe(true)
  })
})
