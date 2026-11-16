import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { findIconSource } from '../scripts/lib/companion-icon-source.mjs'

// `pnpm apps:icons` threw on Masareef: its Expo app sits one folder deeper
// (masareef/masareef-app), and the script only looked at <slug>/assets.
describe('findIconSource', () => {
  const root = join('R')
  const only = (path: string) => (p: unknown) => p === path

  it('finds an app at the folder root', () => {
    const icon = join(root, 'rafiq', 'assets', 'images', 'icon.png')
    expect(findIconSource(root, 'rafiq', only(icon)).src).toBe(icon)
  })

  it('finds an app inside a monorepo folder', () => {
    const icon = join(
      root,
      'masareef',
      'masareef-app',
      'assets',
      'images',
      'icon.png'
    )
    expect(findIconSource(root, 'masareef', only(icon)).src).toBe(icon)
  })

  it('reports every path it tried when there is none', () => {
    const r = findIconSource(root, 'ghost', () => false)
    expect(r.src).toBeNull()
    expect(r.tried).toHaveLength(2)
  })
})
