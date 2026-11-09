import { mergePeople, peopleCap } from '@/scripts/lib/people-set.mjs'
import { describe, expect, it } from 'vitest'

const p = (id: number) => ({ id, name: `P${id}`, profile_path: '/x.jpg' })

describe('mergePeople', () => {
  it('keeps hand-named ids when the set is already at the cap', () => {
    const out = mergePeople({
      existing: [p(1), p(2)],
      manual: [p(3)],
      ranked: [p(4)],
      cap: 2,
    })
    expect(out.map((x) => x.id)).toEqual([1, 2, 3])
  })

  it('never drops a shipped person and fills from the catalogue up to the cap', () => {
    const out = mergePeople({
      existing: [p(1)],
      manual: [],
      ranked: [p(1), p(5), p(6), p(7)],
      cap: 3,
    })
    expect(out.map((x) => x.id)).toEqual([1, 5, 6])
  })
})

describe('peopleCap', () => {
  it('does not grow from the catalogue when there is no build to measure', () => {
    expect(
      peopleCap({
        before: 764,
        totalFiles: null,
        personFiles: null,
        target: 18_000,
        perPerson: 6,
      })
    ).toBe(764)
  })

  it('spends what the rest of the site leaves', () => {
    expect(
      peopleCap({
        before: 100,
        totalFiles: 12_000,
        personFiles: 600,
        target: 18_000,
        perPerson: 6,
      })
    ).toBe(1100)
  })
})
