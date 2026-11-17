/**
 * Whether the Shortcuts group (Movies, Series, Home, apps) renders in the
 * search palette.
 *
 * It used to render under every state. The first query swapped the short idle
 * hint above it for a taller skeleton, which pushed the visible shortcuts down
 * and out of a phone's viewport: a 0.247 layout shift on the first search.
 * Shortcuts now belong to the idle panel; once a search starts they are
 * removed rather than moved, so nothing that stays on screen shifts.
 */
export function shortcutsVisible(
  status: 'idle' | 'loading' | 'empty' | 'link' | 'failed' | 'results'
): boolean {
  return status === 'idle'
}
