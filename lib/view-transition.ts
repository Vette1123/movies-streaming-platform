/**
 * The view-transition abort guard.
 *
 * React 19.3 starts a view transition for a details navigation (the crossfade
 * in components/media/details-page-transition.tsx) and hangs two `.finally()`
 * calls off the transition's `ready` and `finished` promises WITHOUT catching
 * them. That code is React's RSC flush, shipped inside Next's app-page
 * runtime.
 *
 * A transition that gets SKIPPED rejects both promises with `AbortError:
 * Transition was skipped` — the browser skips a transition when a second
 * navigation interrupts it, or when the document is hidden mid-animation.
 * Nothing catches that rejection, so the browser reports an unhandled
 * rejection, PostHog autocaptures it as a $exception, and it lands in error
 * tracking as a production error (GitHub issue #112).
 *
 * The guard wraps the promises so an abort RESOLVES instead of rejecting. The
 * transition is still skipped — that is the browser's decision, and nothing
 * here changes what a reader sees — but nothing rejects that nobody catches.
 * The styles React attached for the transition are still cleaned up: it hooks
 * its cleanup onto `.finally()`, which runs on a rejection too.
 */

type StartViewTransition = (
  callbackOptions?: ViewTransitionUpdateCallback | StartViewTransitionOptions
) => ViewTransition

/**
 * Swallow an abort. The transition is over; that is not a failure.
 *
 * The `.catch` also marks the ORIGINAL promise as handled, which is the half
 * that matters: the browser only reports an unhandled rejection for a promise
 * nobody ever caught, and the browser's own transition object is the one that
 * rejects.
 */
const ignoreAbort = (promise: Promise<void>): Promise<void> =>
  promise.catch(() => undefined)

/**
 * Wrap a `startViewTransition` so a skipped transition cannot produce an
 * unhandled rejection. Pure: it takes the starter and returns a new one, so
 * the behaviour can be tested without a browser.
 */
export function guardViewTransition(
  start: StartViewTransition,
  receiver: unknown = document
): StartViewTransition {
  return (callbackOptions) => {
    const transition = (start as (options?: unknown) => ViewTransition).call(
      receiver,
      callbackOptions
    )
    return {
      ready: ignoreAbort(transition.ready),
      finished: ignoreAbort(transition.finished),
      updateCallbackDone: ignoreAbort(transition.updateCallbackDone),
      types: transition.types,
      skipTransition: () => transition.skipTransition(),
    }
  }
}

/** The marker that says "this starter is already guarded". */
const GUARDED = '__reelyGuarded'

/**
 * Install the guard on a document. Idempotent: the second call is a no-op, so
 * a remount (or React's double-invoked effects in development) cannot stack two
 * wrappers.
 *
 * Returns true when the guard was installed by this call.
 */
export function installViewTransitionAbortGuard(
  host: Document = document
): boolean {
  const start = host.startViewTransition
  if (!start) return false
  if ((start as unknown as Record<string, unknown>)[GUARDED]) return false
  const guarded = guardViewTransition(start as StartViewTransition, host)
  ;(guarded as unknown as Record<string, unknown>)[GUARDED] = true
  host.startViewTransition = guarded
  return true
}
