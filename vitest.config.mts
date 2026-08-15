import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * Node-only tests for the pure logic behind accounts, billing and sync.
 *
 * There is deliberately no DOM environment and no component testing here. What
 * these cover is the code where a bug is silent and expensive — who is entitled,
 * whether a webhook is genuine, which way a sync conflict resolves — and all of
 * it was written as pure functions precisely so it could be tested this way.
 * Everything visual is still verified in a real browser; see CLAUDE.md.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
