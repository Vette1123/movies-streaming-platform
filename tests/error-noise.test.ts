import type { CaptureResult } from 'posthog-js'
import { describe, expect, it } from 'vitest'

import { ApiError } from '@/lib/api-client'
import { apiErrorStatus, isExpectedApiStatus } from '@/lib/client-errors'
import { shouldDropException } from '@/lib/error-noise'

/**
 * The noise filter is the one piece of analytics code that can silently do the
 * wrong thing in either direction: too loose and every real regression is buried
 * under browser-extension noise, too tight and a genuine crash never reaches the
 * dashboard at all. Neither failure shows up in a browser — the page looks fine
 * both ways — so the rules are pinned here.
 */

const CHUNK = 'https://www.reely.space/_next/static/chunks/main-abc123.js'

const exception = (
  value: string,
  frames?: { filename?: string }[]
): CaptureResult =>
  ({
    event: '$exception',
    properties: {
      $exception_list: [
        {
          type: value.split(':')[0],
          value,
          ...(frames ? { stacktrace: { type: 'raw', frames } } : {}),
        },
      ],
    },
  }) as unknown as CaptureResult

describe('shouldDropException', () => {
  it('drops the removeChild collision in all three engines', () => {
    // A translator or extension moved a node out from under React's reconciler.
    // The frames ARE ours (react-dom), so only the wording identifies it.
    for (const value of [
      "NotFoundError: Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node.",
      'NotFoundError: The object can not be found here.',
      'NotFoundError: Node.removeChild: The node to be removed is not a child of this node',
    ]) {
      expect(shouldDropException(exception(value, [{ filename: CHUNK }]))).toBe(
        true
      )
    }
  })

  it('drops a stack that names files, none of them ours', () => {
    // Injected code on iOS is attributed to the document url, which ships no
    // JavaScript of ours — this is the translator's mutual recursion.
    const event = exception('RangeError: Maximum call stack size exceeded.', [
      { filename: 'https://www.reely.space/tv-shows' },
      { filename: 'https://www.reely.space/support' },
    ])
    expect(shouldDropException(event)).toBe(true)
  })

  it('keeps the same error when one frame is ours', () => {
    const event = exception('RangeError: Maximum call stack size exceeded.', [
      { filename: 'https://www.reely.space/tv-shows' },
      { filename: CHUNK },
    ])
    expect(shouldDropException(event)).toBe(false)
  })

  it('keeps an error whose stack names no files at all', () => {
    expect(
      shouldDropException(exception('TypeError: x is not a function'))
    ).toBe(false)
    expect(
      shouldDropException(
        exception('TypeError: x is not a function', [
          {},
          { filename: 42 as never },
        ])
      )
    ).toBe(false)
  })

  it('drops stale-bundle and transport failures, keeps real ones', () => {
    expect(
      shouldDropException(exception('ChunkLoadError: Loading chunk 42 failed'))
    ).toBe(true)
    expect(shouldDropException(exception('TypeError: Failed to fetch'))).toBe(
      true
    )
    expect(
      shouldDropException(
        exception(
          "TypeError: Cannot read properties of undefined (reading 'id')",
          [{ filename: CHUNK }]
        )
      )
    ).toBe(false)
  })
})

describe('api error status', () => {
  it('reads the status off an ApiError only', () => {
    expect(apiErrorStatus(new ApiError(404, '/api/media/tv/9999999'))).toBe(404)
    expect(apiErrorStatus(new Error('boom'))).toBeUndefined()
    expect(apiErrorStatus('boom')).toBeUndefined()
  })

  it('treats 4xx as expected, except the two that mean "later"', () => {
    expect(isExpectedApiStatus(404)).toBe(true)
    expect(isExpectedApiStatus(403)).toBe(true)
    expect(isExpectedApiStatus(408)).toBe(false)
    expect(isExpectedApiStatus(429)).toBe(false)
    expect(isExpectedApiStatus(500)).toBe(false)
    expect(isExpectedApiStatus(undefined)).toBe(false)
  })

  it('carries the path and status in the message', () => {
    expect(new ApiError(404, '/api/media/tv/1').message).toBe(
      '/api/media/tv/1 failed: 404'
    )
  })
})
