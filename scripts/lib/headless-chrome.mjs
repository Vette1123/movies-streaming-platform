// Headless Chrome over the DevTools protocol, with Node's own WebSocket and no
// dependency. Shared by the browser probes (search-scroll-probe, resume-probe):
// launch, one CDP session on the first page, evaluate, and a clean teardown.
//
// CHROME_PATH overrides the browser; default is the stock install location.

import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const DEFAULT_CHROME = {
  win32: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  linux: 'google-chrome',
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Fails loudly, with the command that fixes it, when a server is not up. */
export async function requireServer(url, hint) {
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
  } catch (error) {
    throw new Error(`${url} is not answering (${error.message}) — ${hint}`)
  }
}

/**
 * Launch Chrome and attach to its first page.
 *
 * `onEvent(fn)` sees every protocol event (Fetch.requestPaused and friends);
 * `evaluate(expression, contextId?)` returns the value or throws the page's own
 * error; `close()` kills the browser and removes its throwaway profile.
 */
export async function openHeadlessChrome({ port, label = 'probe' }) {
  const chromePath = process.env.CHROME_PATH ?? DEFAULT_CHROME[process.platform]
  const profile = mkdtempSync(join(tmpdir(), `${label}-`))
  const chrome = spawn(
    chromePath,
    [
      '--headless=new',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      '--no-first-run',
      // The probes press play; a headless tab has no user gesture to spend.
      '--autoplay-policy=no-user-gesture-required',
      'about:blank',
    ],
    { stdio: 'ignore' }
  )

  let ws
  const close = async () => {
    ws?.close()
    chrome.kill()
    await sleep(300)
    try {
      rmSync(profile, { recursive: true, force: true })
    } catch {}
  }

  try {
    let page
    for (let i = 0; i < 50 && !page; i++) {
      await sleep(200)
      try {
        const targets = await (
          await fetch(`http://127.0.0.1:${port}/json`)
        ).json()
        page = targets.find((t) => t.type === 'page')
      } catch {}
    }
    if (!page)
      throw new Error(`Chrome never opened a debugging port at ${chromePath}`)

    ws = new WebSocket(page.webSocketDebuggerUrl)
    await new Promise((resolve) => ws.addEventListener('open', resolve))
  } catch (error) {
    await close()
    throw error
  }

  let seq = 0
  const pending = new Map()
  const listeners = new Set()
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const id = ++seq
      pending.set(id, resolve)
      ws.send(JSON.stringify({ id, method, params }))
    })
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data)
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg)
      pending.delete(msg.id)
      return
    }
    if (msg.method) listeners.forEach((fn) => fn(msg))
  })

  const evaluate = async (expression, contextId) => {
    const r = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
      ...(contextId ? { contextId } : {}),
    })
    const err = r.result?.exceptionDetails
    if (err)
      throw new Error(`in page: ${err.exception?.description ?? err.text}`)
    return r.result?.result?.value
  }

  return {
    send,
    evaluate,
    onEvent: (fn) => listeners.add(fn),
    close,
  }
}
