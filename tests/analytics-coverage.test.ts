import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { EVENTS } from '@/lib/analytics'

// Every event must have a caller, or the dashboards built on it read zero and
// look like nobody uses the feature. Derived milestones are fired by track()
// itself, and the raw `track` path is internal.
const DERIVED = new Set(['first_play', 'first_core_use'])

const root = path.resolve(__dirname, '..')
const SOURCE_DIRS = ['app', 'components', 'hooks', 'lib', 'providers']

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full))
    else if (/\.(ts|tsx)$/.test(name)) out.push(full)
  }
  return out
}

describe('analytics coverage', () => {
  const analytics = readFileSync(path.join(root, 'lib/analytics.ts'), 'utf8')
  const others = SOURCE_DIRS.flatMap((dir) => sourceFiles(path.join(root, dir)))
    .filter((file) => !file.endsWith(path.join('lib', 'analytics.ts')))
    .map((file) => readFileSync(file, 'utf8'))
    .join('\n')
    // An import is not a use. Anything left that names the helper — a call or
    // a callback (`subscribe(trackImageHostFallback)`) — is.
    .replace(/^import[\s\S]*?from\s+'[^']+'$/gm, '')

  // helper name → the EVENTS keys it sends
  const helpers = [
    ...analytics.matchAll(/export function (track\w+)\([\s\S]*?\n}\n/g),
  ].map((match) => ({
    name: match[1],
    keys: [...match[0].matchAll(/EVENTS\.(\w+)/g)].map((m) => m[1]),
  }))

  it('every event is sent by a helper that something actually calls', () => {
    const uncalled: string[] = []
    for (const [key, event] of Object.entries(EVENTS)) {
      if (DERIVED.has(event)) continue
      const senders = helpers.filter((helper) => helper.keys.includes(key))
      const called = senders.some((helper) =>
        new RegExp(`\\b${helper.name}\\b`).test(others)
      )
      if (!called) uncalled.push(event)
    }
    expect(uncalled).toEqual([])
  })
})
