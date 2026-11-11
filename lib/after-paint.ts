// Let an interaction paint before the expensive work it asked for.
//
// INP measures from the input to the next frame painted after the handlers
// run. Whatever the handler renders lands in that frame: on Watch Now that was
// the whole player swap (hero copy out, player stage in, the iframe created),
// and phones painted it 620-692ms after the tap (PostHog, p75 by target). The
// press itself (the button's :active scale) is cheap. Paint it, then do the
// swap in the next task, where it delays nothing the visitor is waiting on.
//
// rAF + setTimeout(0) is "after the next paint": rAF runs inside the frame's
// rendering steps, and a task queued there runs once the frame is out. A
// hidden tab gets no frames, so a plain timeout backs it up; whichever fires
// first wins and the work runs exactly once.

const HIDDEN_TAB_FALLBACK_MS = 100

export function afterNextPaint(work: () => void): void {
  let done = false
  const run = () => {
    if (done) return
    done = true
    work()
  }
  requestAnimationFrame(() => setTimeout(run, 0))
  setTimeout(run, HIDDEN_TAB_FALLBACK_MS)
}
