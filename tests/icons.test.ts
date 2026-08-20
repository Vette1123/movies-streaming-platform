import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { APPLE_SPLASH } from '@/app/_icons/apple-splash'
import { ICON_VERSION, versionedIcon } from '@/app/_icons/version'

/**
 * The icon cache-busting version has to be identical in four places, and three
 * of them are static files no compiler reads: `public/site.webmanifest`,
 * `public/browserconfig.xml`, and the `?v=` the app itself emits.
 *
 * Drift is silent and expensive in one direction only — an INSTALLED PWA keeps
 * the home-screen icon it was installed with until the manifest `src` STRING
 * changes, so a bumped constant with an unbumped manifest ships new art that
 * reaches nobody who already installed the app. Nothing on screen says so.
 *
 * Same reason these assert the file EXISTS: a `?v=` on a path that was renamed
 * is a 404 the manifest still advertises as an icon.
 */

const manifest = JSON.parse(
  readFileSync('public/site.webmanifest', 'utf8')
) as {
  icons: { src: string }[]
  screenshots: { src: string }[]
  shortcuts: { icons?: { src: string }[] }[]
}

const browserconfig = readFileSync('public/browserconfig.xml', 'utf8')

const manifestSrcs = [
  ...manifest.icons.map((i) => i.src),
  ...manifest.screenshots.map((s) => s.src),
  ...manifest.shortcuts.flatMap((s) => (s.icons ?? []).map((i) => i.src)),
]

describe('icon versioning', () => {
  it('stamps every manifest src with the current version', () => {
    expect(manifestSrcs.length).toBeGreaterThan(0)
    for (const src of manifestSrcs) {
      expect(src, `${src} is not stamped with ?v=${ICON_VERSION}`).toBe(
        versionedIcon(src.split('?')[0])
      )
    }
  })

  it('stamps the browserconfig tile with the current version', () => {
    expect(browserconfig).toContain(
      `src="${versionedIcon('/mstile-150x150.png')}"`
    )
  })

  it('points every stamped src at a file that exists', () => {
    for (const src of manifestSrcs) {
      const path = `public${src.split('?')[0]}`
      expect(existsSync(path), `${path} is missing`).toBe(true)
    }
  })

  it('renders every launch screen the layout links', () => {
    expect(APPLE_SPLASH.length).toBeGreaterThan(0)
    for (const { file } of APPLE_SPLASH) {
      expect(existsSync(`public${file}`), `public${file} is missing`).toBe(true)
    }
  })
})
