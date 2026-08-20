'use client'

import * as React from 'react'
import * as SheetPrimitive from '@radix-ui/react-dialog'
import { cva, type VariantProps } from 'class-variance-authority'
import { X } from 'lucide-react'

import { cn } from '@/lib/utils'

const Sheet = SheetPrimitive.Root

const SheetTrigger = SheetPrimitive.Trigger

const SheetClose = SheetPrimitive.Close

const SheetPortal = ({ ...props }: SheetPrimitive.DialogPortalProps) => (
  <SheetPrimitive.Portal {...props} />
)
SheetPortal.displayName = SheetPrimitive.Portal.displayName

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    className={cn(
      'bg-background/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 backdrop-blur-xs',
      className
    )}
    {...props}
    ref={ref}
  />
))
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName

const sheetVariants = cva(
  'fixed z-50 gap-4 bg-background p-6 shadow-lg transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500 data-dragging:transition-none data-dragging:duration-0',
  {
    variants: {
      side: {
        top: 'inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top',
        bottom:
          'inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
        left: 'inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm',
        right:
          'inset-y-0 right-0 h-full w-3/4  border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm',
      },
    },
    defaultVariants: {
      side: 'right',
    },
  }
)

interface SheetContentProps
  extends
    React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> {
  /** Bottom sheets only: a grab handle that can be dragged or flicked away. */
  dragToClose?: boolean
}

/**
 * How far the sheet has to be dragged, or how fast it has to be flicked, before
 * letting go dismisses it instead of springing back. Both are needed: a slow
 * drag halfway down is a dismissal, and so is a quick flick that never got
 * there.
 */
const DRAG_CLOSE_PX = 120
const DRAG_CLOSE_VELOCITY = 0.6 // px per ms

/**
 * A grab handle, and the pointer maths behind it.
 *
 * Only a bottom sheet gets one, and the drag only ever starts on the handle
 * itself — starting it anywhere in the body would mean every list inside a
 * sheet has to fight the sheet for the same vertical gesture, and the list
 * loses in ways nobody can predict. The handle is a big enough target to be the
 * obvious place to grab.
 */
function useSheetDrag(enabled: boolean) {
  const closeRef = React.useRef<HTMLButtonElement | null>(null)
  const start = React.useRef({ y: 0, t: 0 })
  // The live drag state, as a ref rather than the state below.
  //
  // A pointer gesture ends with pointerup AND, immediately after it, a
  // pointercancel — the browser fires one when capture is released and the
  // element under the finger goes away, which is exactly what closing the sheet
  // does. Both handlers run in the same tick, so both saw `dragging` still true
  // from the render they were created in, and both clicked Close: the sheet
  // shut, and the click that landed after it took the next thing with it. The
  // ref settles synchronously, so the second event finds the gesture already
  // over and does nothing.
  const active = React.useRef(false)
  const [offset, setOffset] = React.useState(0)
  const [dragging, setDragging] = React.useState(false)

  const end = React.useCallback(() => {
    active.current = false
    setDragging(false)
    setOffset(0)
  }, [])

  const onPointerDown = (event: React.PointerEvent) => {
    if (!enabled || event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    start.current = { y: event.clientY, t: event.timeStamp }
    active.current = true
    setDragging(true)
  }

  const onPointerMove = (event: React.PointerEvent) => {
    if (!active.current) return
    // Down only. Dragging a bottom sheet upward is not a gesture it has an
    // answer for, and rubber-banding one that is already at its max height
    // just looks broken.
    setOffset(Math.max(0, event.clientY - start.current.y))
  }

  const onPointerUp = (event: React.PointerEvent) => {
    if (!active.current) return
    const travelled = Math.max(0, event.clientY - start.current.y)
    const elapsed = Math.max(1, event.timeStamp - start.current.t)
    const flicked = travelled / elapsed > DRAG_CLOSE_VELOCITY && travelled > 24
    // Before the click, so the pointercancel that follows finds it settled.
    end()
    if (travelled > DRAG_CLOSE_PX || flicked) {
      // Let Radix run its own exit animation from wherever the finger left it.
      closeRef.current?.click()
    }
  }

  // A cancelled pointer is not a decision. It springs back; it never closes.
  const onPointerCancel = () => {
    if (!active.current) return
    end()
  }

  return {
    closeRef,
    offset,
    dragging,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
    },
  }
}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(({ side = 'right', className, children, dragToClose, ...props }, ref) => {
  const draggable = dragToClose === true && side === 'bottom'
  const { closeRef, offset, dragging, handlers } = useSheetDrag(draggable)

  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        ref={ref}
        className={cn(sheetVariants({ side }), className)}
        style={
          offset ? { transform: `translate3d(0, ${offset}px, 0)` } : undefined
        }
        // No transition while the finger is down — the sheet has to track it
        // exactly — and a short one on release so a spring-back is not a jump.
        data-dragging={dragging ? '' : undefined}
        {...props}
      >
        {draggable && (
          <div
            {...handlers}
            aria-hidden
            className="absolute inset-x-0 top-0 flex h-8 cursor-grab touch-none items-center justify-center active:cursor-grabbing"
          >
            <span className="bg-muted-foreground/40 h-1 w-10 rounded-full" />
          </div>
        )}
        {children}
        <SheetPrimitive.Close
          ref={closeRef}
          className="ring-offset-background focus:ring-ring data-[state=open]:bg-secondary absolute top-4 right-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPortal>
  )
})
SheetContent.displayName = SheetPrimitive.Content.displayName

const SheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col space-y-2 text-center sm:text-left',
      className
    )}
    {...props}
  />
)
SheetHeader.displayName = 'SheetHeader'

const SheetFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2',
      className
    )}
    {...props}
  />
)
SheetFooter.displayName = 'SheetFooter'

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn('text-foreground text-lg font-semibold', className)}
    {...props}
  />
))
SheetTitle.displayName = SheetPrimitive.Title.displayName

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn('text-muted-foreground text-sm', className)}
    {...props}
  />
))
SheetDescription.displayName = SheetPrimitive.Description.displayName

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
