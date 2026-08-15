/**
 * The slice of the Workers runtime this project actually calls.
 *
 * Hand-written rather than `@cloudflare/workers-types`, which declares the whole
 * runtime GLOBALLY — including its own `Request`, `Response` and `fetch` — and
 * would then be fighting the `dom` lib the app half of this repo is compiled
 * against. The alternative (a second tsconfig for the Worker) buys nothing: the
 * Worker is bundled by esbuild, which strips types without checking them, so
 * these declarations exist for the editor and `tsc --noEmit`, not for the build.
 *
 * Add to it when a new binding or method is used; it is meant to stay small.
 */

interface D1Result<T = Record<string, unknown>> {
  results: T[]
  success: boolean
  meta: Record<string, unknown>
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  first<T = Record<string, unknown>>(column?: string): Promise<T | null>
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>
}

interface D1Database {
  prepare(query: string): D1PreparedStatement
  batch<T = Record<string, unknown>>(
    statements: D1PreparedStatement[]
  ): Promise<D1Result<T>[]>
  exec(query: string): Promise<{ count: number; duration: number }>
}

/** What `env` carries. `ASSETS` is the static-asset binding wrangler adds. */
interface WorkerEnv {
  DB?: D1Database
  ASSETS?: { fetch: (input: Request | string | URL) => Promise<Response> }
  [key: string]: unknown
}

/** The `ctx` a Worker handler is given. Only `waitUntil` is used. */
interface WaitUntilContext {
  waitUntil(promise: Promise<unknown>): void
}
