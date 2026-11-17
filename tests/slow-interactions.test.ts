import { describe, expect, it } from 'vitest'

import {
  describeTarget,
  longer,
  scriptSource,
  SLOW_MS,
  slowInteractionProps,
  type EventTiming,
} from '@/lib/slow-interactions'

const ORIGIN = 'https://www.reely.space'

// The field shape on 17 Nov: 1,996 ms in handlers, 4 ms of paint, no element.
const tap: EventTiming = {
  name: 'pointerup',
  startTime: 12_340,
  duration: 2000,
  processingStart: 12_340,
  processingEnd: 14_336,
}

describe('slowInteractionProps', () => {
  it('ignores a tap under the threshold', () => {
    expect(
      slowInteractionProps({ ...tap, duration: SLOW_MS - 1 }, [], {
        target: '',
        hidden: false,
        origin: ORIGIN,
      })
    ).toBeNull()
  })

  it('splits the tap and names the scripts of the frames it overlaps, longest first', () => {
    const props = slowInteractionProps(
      tap,
      [
        {
          startTime: 1000,
          duration: 300,
          scripts: [{ invoker: 'TimerHandler:setTimeout', duration: 290 }],
        },
        {
          startTime: 12_330,
          duration: 2010,
          scripts: [
            {
              invoker: 'BUTTON.onclick',
              sourceURL: `${ORIGIN}/_next/static/chunks/app.js?v=1`,
              sourceFunctionName: 'handlePaste',
              duration: 400,
            },
            {
              invoker: `${ORIGIN}/_next/static/chunks/ph.js`,
              sourceURL: 'https://eu-assets.i.posthog.com/static/recorder.js',
              duration: 1500,
              forcedStyleAndLayoutDuration: 220,
            },
          ],
        },
      ],
      { target: 'button.card-hover', hidden: true, origin: ORIGIN }
    )
    expect(props).toEqual({
      interaction: 'pointerup',
      duration_ms: 2000,
      input_delay_ms: 0,
      processing_ms: 1996,
      presentation_ms: 4,
      target: 'button.card-hover',
      since_load_s: 12.3,
      hidden: true,
      frames: 1,
      script_ms: 1900,
      forced_layout_ms: 220,
      top_scripts: [
        'ph.js @ eu-assets.i.posthog.com/recorder.js 1500ms',
        'BUTTON.onclick @ app.js handlePaste 400ms',
      ],
    })
  })
})

describe('longer', () => {
  it('breaks a duration tie by handler time, so a click beats its pointerup', () => {
    const pointerup = { ...tap, processingStart: 12_340, processingEnd: 12_340 }
    expect(longer(tap, pointerup)).toBe(true)
    expect(longer(pointerup, tap)).toBe(false)
    expect(longer({ ...pointerup, duration: 2001 }, tap)).toBe(true)
  })
})

describe('scriptSource', () => {
  it('keeps a file name, a foreign host, or only an extension scheme', () => {
    expect(
      scriptSource(`${ORIGIN}/_next/static/chunks/a.js?x=1#y`, ORIGIN)
    ).toBe('a.js')
    expect(scriptSource('https://cdn.example/lib/b.js', ORIGIN)).toBe(
      'cdn.example/b.js'
    )
    expect(scriptSource('chrome-extension://abcdef/content.js', ORIGIN)).toBe(
      'chrome-extension'
    )
    expect(scriptSource('', ORIGIN)).toBe('')
    expect(scriptSource('not a url', ORIGIN)).toBe('')
  })
})

describe('describeTarget', () => {
  it('is a selector, never text', () => {
    expect(describeTarget({ tagName: 'INPUT', id: 'paste-link' })).toBe(
      'input#paste-link'
    )
    expect(
      describeTarget({
        tagName: 'BUTTON',
        className: 'card-hover  absolute right-1.5 flex',
      })
    ).toBe('button.card-hover.absolute.right-1.5')
    expect(
      describeTarget({ tagName: 'svg', className: { baseVal: 'x' } })
    ).toBe('svg')
    expect(describeTarget(null)).toBe('')
  })
})
