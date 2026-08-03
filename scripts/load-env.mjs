import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Load `.env.local` if it exists, the way scripts/build-worker.mjs does.
 *
 * CI puts the config on the environment already; locally it lives in
 * `.env.local`. Shared because every cf-* script needs `CLOUDFLARE_API_TOKEN`
 * and having to prefix each invocation with it by hand is the kind of paper cut
 * that makes an operator skip the check.
 */
export function loadLocalEnv() {
  try {
    process.loadEnvFile(path.join(root, '.env.local'))
  } catch {
    // No .env.local (CI) — the environment already carries everything.
  }
}
