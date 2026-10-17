import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

// The crossfade into a details page keeps the page being left on screen only
// because <html> carries an inline view-transition-name (app/layout.tsx). When
// nothing outside a <ViewTransition> boundary updates, React hides the root's
// snapshot for the transition unless it finds that inline name, and the old
// page cut to bare background while the new one faded in over nothing. Both
// halves are pinned here, so a React upgrade that changes the check fails this
// instead of quietly bringing the 200ms blank back.

const read = (path: string | URL) => readFileSync(path, 'utf8')

describe('the crossfade into a details page keeps the old page', () => {
  it('names the root inline, on <html> itself', () => {
    const layout = read(new URL('../app/layout.tsx', import.meta.url))
    expect(layout).toMatch(
      /<html[^>]*style=\{\{ viewTransitionName: 'root' \}\}[^>]*>/
    )
  })

  it("React's root cancel still steps aside for an inline name", () => {
    // The react-dom the app ships is Next's compiled copy, not node_modules/react-dom.
    const require = createRequire(import.meta.url)
    const reactDom = read(
      require.resolve('next/dist/compiled/react-dom/cjs/react-dom-client.production.js')
    )
    expect(reactDom).toMatch(/""\s*===\s*\w+\.style\.viewTransitionName/)
  })
})
