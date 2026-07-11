'use client'

import * as React from 'react'

export interface VisualViewportState {
  /** Whether real measurements are available (client-mounted + API present). */
  ready: boolean
  /** Height of the visible area in px (shrinks when the keyboard opens). */
  height: number
  /** Top offset of the visual viewport vs. the layout viewport (iOS shifts it). */
  offsetTop: number
  /** Estimated on-screen keyboard height in px (0 when closed). */
  keyboardHeight: number
  /** True once the keyboard has meaningfully shrunk the viewport. */
  keyboardOpen: boolean
}

// A keyboard reduces the viewport by a few hundred px; ignore small toolbar
// (URL-bar) shifts so we don't reflow the dialog for those.
const KEYBOARD_THRESHOLD = 120

const INITIAL: VisualViewportState = {
  ready: false,
  height: 0,
  offsetTop: 0,
  keyboardHeight: 0,
  keyboardOpen: false,
}

/**
 * Tracks the on-screen keyboard via the VisualViewport API so a fixed overlay
 * (e.g. the search dialog) can stay above the keyboard on mobile. Listeners
 * attach only while `enabled`, so there is zero cost when the overlay is closed.
 */
export function useVisualViewport(enabled: boolean): VisualViewportState {
  const [state, setState] = React.useState<VisualViewportState>(INITIAL)

  React.useEffect(() => {
    if (!enabled) {
      setState(INITIAL)
      return
    }

    const vv = window.visualViewport
    if (!vv) return

    const update = () => {
      // Layout viewport minus visible viewport (and its offset) ≈ keyboard.
      const keyboardHeight = Math.max(
        0,
        window.innerHeight - vv.height - vv.offsetTop
      )
      setState({
        ready: true,
        height: vv.height,
        offsetTop: vv.offsetTop,
        keyboardHeight,
        keyboardOpen: keyboardHeight > KEYBOARD_THRESHOLD,
      })
    }

    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [enabled])

  return state
}
