import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// A server component that imports a client hook is a build error, and only the
// build sees it: typecheck, lint and dev all pass, so it surfaced as eight red
// deploys in a row (app/watchlist/page.tsx calling useState next to its
// `metadata` export; ratings-strip.tsx calling useCountUp). This catches the
// direct form of it in `pnpm test`, which CI runs before the build.

const root = fileURLToPath(new URL('..', import.meta.url))

const CLIENT_HOOK =
  /import\s+(?:[\w*]+\s*,\s*)?\{[^}]*\b(useState|useEffect|useLayoutEffect|useReducer|useRef|useCallback|useContext|useTransition|useOptimistic|useActionState)\b[^}]*\}\s*from\s*'react'|from\s*'@\/(hooks\/|lib\/use-)/

function* routeFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) yield* routeFiles(path)
    else if (/^(page|layout|template|not-found)\.tsx$/.test(entry.name))
      yield path
  }
}

// Server components outside app/ whose output must stay in the prerendered
// HTML (the ratings strip is how crawlers see the scores).
const EXTRA_SERVER = ['components/media/ratings-strip.tsx']

const serverFiles = [
  ...routeFiles(join(root, 'app')),
  ...EXTRA_SERVER.map((f) => join(root, f)),
].filter((path) => !/^\s*['"]use client['"]/.test(readFileSync(path, 'utf8')))

// Same blind spot, different file: `.group-hover/card.x` in globals.css is not
// a valid selector (the `/` must be escaped), and the dev server 500s every
// page on it while typecheck and lint stay green.
describe('globals.css class selectors escape `/`', () => {
  it('has no bare slash inside a class name', () => {
    const css = readFileSync(join(root, 'styles/globals.css'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/url\([^)]*\)/g, '')
    const selectors = css
      .split('\n')
      .filter((line) => line.trimEnd().endsWith('{'))
    expect(selectors.filter((s) => /\.[\w-]*[^\\\s]\/[\w-]/.test(s))).toEqual(
      []
    )
  })
})

describe('server components import no client hooks', () => {
  it('finds the server files it is meant to guard', () => {
    expect(serverFiles.length).toBeGreaterThan(10)
  })

  it.each(serverFiles.map((p) => [relative(root, p), p]))('%s', (_, path) => {
    expect(readFileSync(path, 'utf8')).not.toMatch(CLIENT_HOOK)
  })
})
