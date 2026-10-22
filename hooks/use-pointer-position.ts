import { useEffect, useState } from 'react'

/**
 * Tracks the pointer as a 0..1 point over the viewport. Returns `[x, y]`.
 *
 * Reduced-motion callers can still read it (they just won't animate with it).
 * Events are passive and the state update is throttled to raf so a fast mouse
 * does not re-render every frame — only the displayed position lags one frame,
   * which is exactly what you want for a parallax layer.
 */
export function usePointerPosition(): [number, number] {
  const [point, setPoint] = useState<[number, number]>([0.5, 0.5])

  useEffect(() => {
    let frame = 0
    const onMove = (e: MouseEvent) => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        setPoint([
          e.clientX / window.innerWidth,
          e.clientY / window.innerHeight,
        ] as [number, number])
      })
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    return () => {
      window.removeEventListener('mousemove', onMove)
      cancelAnimationFrame(frame)
    }
  }, [])

  return point
}
