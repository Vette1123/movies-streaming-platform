import { describe, expect, it, vi } from 'vitest'

import {
  guardViewTransition,
  installViewTransitionAbortGuard,
} from '@/lib/view-transition'

/**
 * The guard is the difference between a skipped animation and a production
 * error in the tracker, and both halves of it are invisible in a browser: the
 * transition is skipped either way, and the reader sees the same page. So the
 * rule is pinned here — the promise React hangs its cleanup on must settle,
 * and it must not settle by rejecting.
 */

/**
 * A transition the browser skipped: every promise rejects with an AbortError.
 *
 * The rejection is already handled here, because these fakes reject the moment
 * they are built — the browser's transition rejects later, when the skip
 * happens, which is the case the guard exists for. Whether the rejection
 * reaches the console as an UNHANDLED one is the browser probe's job
 * (scripts/view-transition-probe.mjs); what is pinned here is that the guard
 * hands React a promise that settles by RESOLVING.
 */
function skippedTransition() {
  const abort = () => {
    const promise = Promise.reject(
      new DOMException('Transition was skipped', 'AbortError')
    )
    promise.catch(() => undefined)
    return promise
  }
  return {
    ready: abort(),
    finished: abort(),
    updateCallbackDone: abort(),
    types: new Set<string>() as unknown as ViewTransitionTypeSet,
    skipTransition: vi.fn(),
  }
}

/** A transition that ran to the end: every promise resolves. */
function finishedTransition() {
  const done = () => Promise.resolve()
  return {
    ready: done(),
    finished: done(),
    updateCallbackDone: done(),
    types: new Set<string>() as unknown as ViewTransitionTypeSet,
    skipTransition: vi.fn(),
  }
}

const start = (transition: ViewTransition) =>
  vi.fn(() => transition) as unknown as Document['startViewTransition']

describe('guardViewTransition', () => {
  it('turns a skipped transition into a resolved promise', async () => {
    const transition = skippedTransition()
    const guarded = guardViewTransition(start(transition), {})

    const result = guarded({ update: () => undefined })

    await expect(result.ready).resolves.toBeUndefined()
    await expect(result.finished).resolves.toBeUndefined()
    await expect(result.updateCallbackDone).resolves.toBeUndefined()
  })

  it('leaves a transition that ran to the end alone', async () => {
    const transition = finishedTransition()
    const guarded = guardViewTransition(start(transition), {})

    const result = guarded({ update: () => undefined })

    await expect(result.ready).resolves.toBeUndefined()
    await expect(result.finished).resolves.toBeUndefined()
  })

  it('keeps the browser transition reachable for skipTransition', () => {
    const transition = skippedTransition()
    const guarded = guardViewTransition(start(transition), {})

    const result = guarded({ update: () => undefined })
    result.skipTransition()

    expect(transition.skipTransition).toHaveBeenCalled()
  })

  it('passes the options through to the browser', () => {
    const transition = finishedTransition()
    const native = start(transition)
    const guarded = guardViewTransition(native, {})

    const options = { update: () => undefined, types: ['to-details'] }
    guarded(options)

    expect(native).toHaveBeenCalledWith(options)
  })
})

describe('installViewTransitionAbortGuard', () => {
  const host = (transition: ViewTransition) =>
    ({
      startViewTransition: start(transition),
    }) as unknown as Document

  it('installs once and refuses to stack', () => {
    const document = host(skippedTransition())

    expect(installViewTransitionAbortGuard(document)).toBe(true)
    expect(installViewTransitionAbortGuard(document)).toBe(false)
  })

  it('does nothing on a browser without view transitions', () => {
    const document = {} as Document

    expect(installViewTransitionAbortGuard(document)).toBe(false)
  })
})
