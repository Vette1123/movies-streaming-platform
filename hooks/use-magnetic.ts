import { useEffect } from 'react'

/**
 * Pulls an element a few pixels toward the cursor while the cursor is ON it
 * (a "magnetic" button), and lets it settle back on leave.
 *
 * Bounded and event-driven on purpose. It used to listen on `window` with no
 * distance cap and run a requestAnimationFrame loop forever: a cursor 1000px
 * away dragged an 8px-strength button ~200px off its slot, so the hero actions
 * wandered away from the pointer, and six of them burned a frame callback each
 * for as long as the page was open.
 *
 * The offset never exceeds `strength / 2` px, so the button cannot slide out
 * from under the pointer that is about to click it. Callers gate `enabled` on
 * a hover pointer — a target that moves under a thumb is hostile.
 */
export function useMagnetic(
  ref: React.RefObject<HTMLElement | null>,
  strength = 8,
  enabled = true
) {
  useEffect(() => {
    const el = ref.current
    if (!el || !enabled) return
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return

    el.style.transition = 'transform 200ms cubic-bezier(0.22, 1, 0.36, 1)'
    const onMove = (e: PointerEvent) => {
      const { x, y } = magneticOffset(el.getBoundingClientRect(), e, strength)
      el.style.transform = `translate(${x}px, ${y}px)`
    }
    const onLeave = () => {
      el.style.transform = ''
    }

    el.addEventListener('pointermove', onMove, { passive: true })
    el.addEventListener('pointerleave', onLeave, { passive: true })
    return () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerleave', onLeave)
      el.style.transform = ''
      el.style.transition = ''
    }
  }, [ref, strength, enabled])
}

/** Offset toward the pointer, clamped to ±strength/2 on each axis. */
export function magneticOffset(
  rect: { left: number; top: number; width: number; height: number },
  point: { clientX: number; clientY: number },
  strength: number
): { x: number; y: number } {
  const half = strength / 2
  const clamp = (v: number) => Math.max(-half, Math.min(half, v))
  const dx = (point.clientX - (rect.left + rect.width / 2)) / rect.width
  const dy = (point.clientY - (rect.top + rect.height / 2)) / rect.height
  return { x: clamp(dx * strength), y: clamp(dy * strength) }
}
