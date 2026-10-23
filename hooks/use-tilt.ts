import { useEffect } from 'react'

/**
 * Tilts an element slightly toward the cursor, so a poster reads like a
 * physical card catching the light, and lays it flat again on leave.
 *
 * Put it on an element NOTHING ELSE transforms. It used to sit on the card's
 * framer motion.div, so it overwrote the hover lift on every mousemove and the
 * two fought; and without `perspective()` the rotation looked flat anyway.
 * Hover-capable pointers only (mousemove never fires for a finger) and off
 * under reduced motion.
 */
export function useTilt(
  ref: React.RefObject<HTMLElement | null>,
  strength = 4,
  enabled = true
) {
  useEffect(() => {
    const el = ref.current
    if (!el || !enabled) return
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      const rotateX = ((e.clientY - rect.top) / rect.height - 0.5) * -strength
      const rotateY = ((e.clientX - rect.left) / rect.width - 0.5) * strength
      el.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`
    }
    const onLeave = () => {
      el.style.transform = ''
    }

    el.addEventListener('mousemove', onMove, { passive: true })
    el.addEventListener('mouseleave', onLeave, { passive: true })
    return () => {
      el.removeEventListener('mousemove', onMove)
      el.removeEventListener('mouseleave', onLeave)
      el.style.transform = ''
    }
  }, [ref, strength, enabled])
}
