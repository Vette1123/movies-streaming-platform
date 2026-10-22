import { useEffect, useRef } from 'react'

/**
 * Makes an element gently follow the cursor (a "magnetic" button). Only runs
 * on hover-capable devices; touchscreens get nothing, which is exactly right
 * because a finger can't hover and a moving target under a thumb is hostile.
 *
 * The element moves at most `strength` pixels in either axis, so it never
 * escapes under the finger or breaks a tap target. Transforms are compositor-
 * only, so this is cheap even across a grid of buttons.
 */
export function useMagnetic(
  ref: React.RefObject<HTMLElement | null>,
  strength = 12,
  enabled = true
) {
  const position = useRef({ x: 0, y: 0 })
  const target = useRef({ x: 0, y: 0 })
  const frame = useRef(0)

  useEffect(() => {
    if (!enabled) return
    const el = ref.current
    if (!el) return

    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2
      target.current.x = ((e.clientX - centerX) / rect.width) * strength
      target.current.y = ((e.clientY - centerY) / rect.height) * strength
    }

    const render = () => {
      position.current.x += (target.current.x - position.current.x) * 0.15
      position.current.y += (target.current.y - position.current.y) * 0.15
      el.style.transform = `translate(${position.current.x}px, ${position.current.y}px)`
      frame.current = requestAnimationFrame(render)
    }
    frame.current = requestAnimationFrame(render)

    window.addEventListener('mousemove', onMove, { passive: true })
    return () => {
      window.removeEventListener('mousemove', onMove)
      cancelAnimationFrame(frame.current)
      el.style.transform = ''
    }
  }, [ref, strength, enabled])
}
