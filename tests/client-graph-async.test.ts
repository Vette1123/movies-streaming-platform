import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * An async component in the CLIENT graph is React error #482: "An unknown
 * Component is an async Client Component. Only Server Components can be async
 * at the moment."
 *
 * The trap is that nothing in the file says "client". A module without
 * 'use client' is a server component UNTIL something in the client graph
 * imports it — and then it is a client component, and React throws when it
 * finds an async one.
 *
 * The details content is exactly that case: app/media-fallback/page.tsx is
 * 'use client' (it is the shell the Worker serves for the ids the build did
 * not prerender) and it imports the details content, so the details content
 * is a client module. Making those two components async to resolve the
 * ratings broke every TAIL page in production — the prerendered ones looked
 * fine, which is why it reached a deploy before anyone saw it.
 *
 * The ratings are resolved by the page (a server component) and handed in as
 * a prop instead. This test is what keeps it that way.
 */

const root = join(process.cwd())

const read = (file: string) => readFileSync(join(root, file), 'utf8')

const CLIENT_GRAPH_ROOTS = ['app/media-fallback/page.tsx']

// The modules the client graph reaches through those roots, and the ones
// that render on a details page. Each is named here because the import
// itself is what puts it in the client graph.
const CLIENT_GRAPH_MODULES = [
  'components/media/details-content.tsx',
  'components/series/details-content.tsx',
]

describe('the client graph', () => {
  it('really does put the details content in it', () => {
    // If this stops being true the rest of this file is testing nothing.
    for (const root of CLIENT_GRAPH_ROOTS) {
      expect(read(root)).toMatch(/^'use client'/m)
    }
    const fallback = read('app/media-fallback/page.tsx')
    for (const file of CLIENT_GRAPH_MODULES) {
      const name = file.split('/').pop()?.replace('.tsx', '')
      expect(fallback).toContain(name)
    }
  })

  it('has no async component in it', () => {
    for (const file of CLIENT_GRAPH_MODULES) {
      const source = read(file)
      // An async component export — `export const X = async (` — in a module
      // the client graph imports is React error #482 at runtime.
      expect(
        source,
        `${file} exports an async component and is imported by a 'use client' module`
      ).not.toMatch(/export\s+const\s+\w+\s*=\s*async\b/)
    }
  })
})
