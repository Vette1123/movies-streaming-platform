'use client'

import * as React from 'react'
import { Loader2, type LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { buttonVariants } from '@/components/ui/button'

/**
 * "Are you sure?", once, for the whole app.
 *
 * There is exactly one shape of this question — icon, consequence, a way out,
 * and a button that does the thing — and it was previously written twice: as a
 * hand-assembled AlertDialog for clearing watch history, and as a raw
 * `window.confirm` for replacing a calendar link. The browser dialog was the
 * worse of the two by a distance: it is chrome-styled rather than app-styled, it
 * says "www.reely.space says", it cannot be dismissed by anything but its own
 * two buttons, and it blocks the main thread while it is up.
 *
 * Anything destructive goes through here now, so the answer to "what does a
 * confirmation look like" is in one file.
 */
interface ConfirmDialogProps {
  /** The control that opens it. Rendered as the trigger, so it keeps its own styling. */
  trigger: React.ReactNode
  title: string
  description: React.ReactNode
  /** Extra body between the description and the buttons — a list of consequences, say. */
  children?: React.ReactNode
  confirmLabel: string
  cancelLabel?: string
  Icon?: LucideIcon
  /**
   * Destructive tints the icon and the action button. Default is for the
   * irreversible-but-not-damaging case, which still deserves a pause.
   */
  tone?: 'destructive' | 'default'
  /**
   * Run on confirm. If it returns a promise the dialog stays open, disabled,
   * with a spinner, until it settles — so nobody presses it twice, and nobody
   * watches an empty page wondering whether it worked.
   */
  onConfirm: () => void | Promise<unknown>
}

const toneStyles = {
  destructive: {
    badge: 'bg-destructive/15 text-destructive ring-destructive/25',
    action: 'bg-destructive text-white hover:bg-destructive/90',
  },
  default: {
    badge: 'bg-primary/15 text-primary ring-primary/25',
    action: '',
  },
}

export function ConfirmDialog({
  trigger,
  title,
  description,
  children,
  confirmLabel,
  cancelLabel = 'Cancel',
  Icon,
  tone = 'destructive',
  onConfirm,
}: ConfirmDialogProps) {
  const [open, setOpen] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const styles = toneStyles[tone]

  const confirm = async (event: React.MouseEvent) => {
    // Radix closes on action by default. An async confirm needs the dialog to
    // survive its own click, so the close is ours to do once the work lands.
    event.preventDefault()
    setPending(true)
    try {
      await onConfirm()
    } finally {
      setPending(false)
      setOpen(false)
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        // Escape and the overlay must not yank the dialog out from under work
        // that is already in flight.
        if (pending) return
        setOpen(next)
      }}
    >
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent
        className={cn(
          'border-border/60 bg-card/95 max-w-md gap-0 overflow-hidden p-0 shadow-2xl backdrop-blur-xl',
          // A hairline of the tone across the top edge, so the dialog reads as
          // serious before a word of it has been.
          'before:absolute before:inset-x-0 before:top-0 before:h-px',
          'before:bg-linear-to-r before:from-transparent before:to-transparent',
          tone === 'destructive'
            ? 'before:via-destructive/60'
            : 'before:via-primary/60'
        )}
      >
        <AlertDialogHeader className="gap-0 space-y-0 p-6 pb-4 text-left sm:text-left">
          <div
            className={cn(
              'mb-4 flex size-11 items-center justify-center rounded-xl ring-1 ring-inset',
              styles.badge
            )}
            aria-hidden
          >
            {Icon ? <Icon className="size-5" /> : null}
          </div>
          <AlertDialogTitle className="text-balance">{title}</AlertDialogTitle>
          <AlertDialogDescription className="mt-2 leading-relaxed">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {children ? <div className="px-6 pb-4">{children}</div> : null}

        {/* Its own band rather than floating under the copy: the buttons are a
            different kind of thing from the sentence above them. */}
        <AlertDialogFooter className="border-border/60 bg-background/40 gap-2 border-t p-4 sm:gap-2">
          <AlertDialogCancel disabled={pending} className="mt-0">
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={confirm}
            className={cn(buttonVariants(), styles.action)}
          >
            {pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
