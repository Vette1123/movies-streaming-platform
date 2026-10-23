#!/usr/bin/env node
/**
 * Stop every local server this checkout started: `pnpm dev`, `pnpm preview`
 * (wrangler/workerd), on any of the dev ports — and prove the ports are free.
 *
 *   pnpm dev:stop
 *
 * Exists because stopping the `pnpm dev` task is not enough: Next's
 * start-server.js child keeps listening after its parent is gone, and a server
 * left running on :3000 is what pushed the next session onto :3001. Only
 * processes whose command line is inside THIS checkout are killed, so another
 * project's server on the same port is left alone (and reported).
 *
 * Windows-only (netstat + taskkill + CIM), which is where this repo is run.
 */
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const PORTS = [3000, 3001, 3002, 8787, 8788]
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

if (process.platform !== 'win32') {
  console.error(
    'dev:stop is Windows-only; use `lsof -i :3000` and kill elsewhere.'
  )
  process.exit(1)
}

const listeners = () => {
  const out = execFileSync('netstat', ['-ano'], { encoding: 'utf8' })
  const found = new Map()
  for (const line of out.split('\n')) {
    if (!line.includes('LISTENING')) continue
    const cols = line.trim().split(/\s+/)
    const port = Number(cols[1]?.split(':').pop())
    if (PORTS.includes(port)) found.set(Number(cols[4]), port)
  }
  return found
}

const commandLine = (pid) =>
  execFileSync(
    'powershell',
    [
      '-NoProfile',
      '-Command',
      `(Get-CimInstance Win32_Process -Filter "ProcessId=${pid}").CommandLine`,
    ],
    { encoding: 'utf8' }
  ).trim()

const before = listeners()
let killed = 0
const foreign = []
for (const [pid, port] of before) {
  const cmd = commandLine(pid)
  if (!cmd.toLowerCase().includes(root.toLowerCase())) {
    foreign.push(`:${port} pid ${pid} (${cmd.slice(0, 90) || 'unknown'})`)
    continue
  }
  execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], {
    stdio: 'ignore',
  })
  console.log(`killed :${port} pid ${pid}`)
  killed += 1
}

const still = [...listeners()].filter(
  ([pid]) => before.has(pid) && !foreign.some((f) => f.includes(`pid ${pid} `))
)
if (still.length) {
  console.error(
    `::error::still listening: ${still.map(([pid, port]) => `:${port} pid ${pid}`).join(', ')}`
  )
  process.exit(1)
}
if (foreign.length)
  console.log(`left alone (not this checkout): ${foreign.join('; ')}`)
console.log(
  killed
    ? `dev:stop — ${killed} server(s) stopped, ports free`
    : 'dev:stop — nothing of ours was running'
)
