import { setDefaultResultOrder } from 'node:dns'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Node 17+ hands back whatever the resolver returns, AAAA first. On a machine
// with an IPv6 address but no working IPv6 route — a home ISP, most corporate
// wifi — every `fetch` to api.cloudflare.com hangs for the full connect timeout
// and then reports `fetch failed`, which reads exactly like a bad token or an
// outage. It cost two false diagnoses on 2026-08-16 (`pnpm waf:apply` and
// wrangler, both while curl to the same host worked). These scripts only ever
// talk to Cloudflare, and Cloudflare has A records everywhere.
setDefaultResultOrder('ipv4first')

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
