import * as React from 'react'

import { afterNextPaint } from '@/lib/after-paint'

// True once an open dialog has painted its first frame; false while closed.
//
// Search and the mobile menu built their whole body (cmdk items, companion
// apps, drawer sections) inside the tap that opened them, so phones painted
// that tap 400-800ms later (PostHog INP by target, Nov 2026). The shell and
// any input still mount in the tap: iOS only raises the keyboard for a focus
// made inside the gesture. The body waits for this flag, one frame later,
// under the open animation.
export function usePaintedOpen(open: boolean): boolean {
  const [painted, setPainted] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    return afterNextPaint(() => setPainted(true))
  }, [open])

  // Reset on close during render, so the next open starts empty again.
  if (!open && painted) setPainted(false)

  return open && painted
}
