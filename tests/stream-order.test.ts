import { describe, expect, it } from 'vitest'

import { parseOrder, reorderSlots } from '../scripts/lib/stream-order.mjs'

const ENV = [
  'TMDB_API_KEY=k',
  'NEXT_PUBLIC_STREAMING_MOVIES_API_URL=https://one.example/embed',
  'NEXT_PUBLIC_STREAMING_MOVIES_API_QUERY=q1',
  'NEXT_PUBLIC_STREAM_SOURCE_2=https://two.example',
  'NEXT_PUBLIC_STREAM_SOURCE_2_QUERY=q2',
  'NEXT_PUBLIC_STREAM_SOURCE_3=https://three.example/embed',
  'OTHER=x',
  'NEXT_PUBLIC_STREAM_SOURCE_4=https://four.example',
  'NEXT_PUBLIC_STREAM_SOURCE_4_LABEL=Four',
  'NEXT_PUBLIC_STREAM_SOURCE_4_MOVIE_PATH=/embed/{id}',
  'NEXT_PUBLIC_STREAM_SOURCE_4_TV_PATH=/embedtv/{id}&s={s}&e={e}',
  'NEXT_PUBLIC_STREAM_SOURCE_5=https://five.example',
  'NEXT_PUBLIC_STREAM_SOURCE_5_QUERY=q5',
]

const get = (lines: string[], name: string) =>
  lines.find((l) => l.startsWith(`${name}=`))?.slice(name.length + 1)

describe('stream:order', () => {
  it('moves every var of a slot together', () => {
    const { lines } = reorderSlots(ENV, [1, 5, 4, 2, 3])
    expect(get(lines, 'NEXT_PUBLIC_STREAMING_MOVIES_API_URL')).toBe(
      'https://one.example/embed'
    )
    expect(get(lines, 'NEXT_PUBLIC_STREAM_SOURCE_2')).toBe(
      'https://five.example'
    )
    expect(get(lines, 'NEXT_PUBLIC_STREAM_SOURCE_2_QUERY')).toBe('q5')
    expect(get(lines, 'NEXT_PUBLIC_STREAM_SOURCE_3')).toBe(
      'https://four.example'
    )
    expect(get(lines, 'NEXT_PUBLIC_STREAM_SOURCE_3_LABEL')).toBe('Four')
    expect(get(lines, 'NEXT_PUBLIC_STREAM_SOURCE_3_TV_PATH')).toBe(
      '/embedtv/{id}&s={s}&e={e}'
    )
    expect(get(lines, 'NEXT_PUBLIC_STREAM_SOURCE_4')).toBe(
      'https://two.example'
    )
    expect(get(lines, 'NEXT_PUBLIC_STREAM_SOURCE_4_QUERY')).toBe('q2')
    expect(get(lines, 'NEXT_PUBLIC_STREAM_SOURCE_5')).toBe(
      'https://three.example/embed'
    )
  })

  // A provider must never arrive with the last occupant's path or label.
  it('drops what the new occupant does not have', () => {
    const { lines, next } = reorderSlots(ENV, [1, 5, 4, 2, 3])
    expect(get(lines, 'NEXT_PUBLIC_STREAM_SOURCE_4_LABEL')).toBeUndefined()
    expect(get(lines, 'NEXT_PUBLIC_STREAM_SOURCE_4_TV_PATH')).toBeUndefined()
    expect(get(lines, 'NEXT_PUBLIC_STREAM_SOURCE_5_QUERY')).toBeUndefined()
    expect(next.get('NEXT_PUBLIC_STREAM_SOURCE_4_TV_PATH')).toBeUndefined()
    expect(next.has('NEXT_PUBLIC_STREAM_SOURCE_4_TV_PATH')).toBe(true)
  })

  it('keeps every other line, and the identity order is a no-op', () => {
    const { lines } = reorderSlots(ENV, [1, 5, 4, 2, 3])
    expect(lines).toContain('TMDB_API_KEY=k')
    expect(lines).toContain('OTHER=x')
    expect(lines).toHaveLength(ENV.length)
    expect(new Set(reorderSlots(ENV, [1, 2, 3, 4, 5]).lines)).toEqual(
      new Set(ENV)
    )
  })

  it('refuses anything but a permutation of 1-5', () => {
    expect(parseOrder([1, 2, 3, 4]).error).toMatch(/permutation/)
    expect(parseOrder([1, 1, 3, 4, 5]).error).toMatch(/permutation/)
    expect(parseOrder([1, 5, 4, 2, 3]).order).toEqual([1, 5, 4, 2, 3])
  })
})
