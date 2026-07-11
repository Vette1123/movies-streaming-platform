'use client'

import * as React from 'react'
import { DialogProps } from '@radix-ui/react-dialog'
import * as VisuallyHidden from '@radix-ui/react-visually-hidden'
import { Command as CommandPrimitive } from 'cmdk'
import { Loader, Search } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useVisualViewport } from '@/hooks/use-visual-viewport'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

const Command = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
  <CommandPrimitive
    ref={ref}
    className={cn(
      'bg-popover text-popover-foreground flex h-full w-full flex-col overflow-hidden rounded-md',
      className
    )}
    {...props}
  />
))
Command.displayName = CommandPrimitive.displayName

interface CommandDialogProps
  extends
    DialogProps,
    Omit<
      React.ComponentPropsWithoutRef<typeof CommandPrimitive>,
      keyof DialogProps
    > {}

// Matches Tailwind's `sm` breakpoint — below it we treat the dialog as the
// mobile, keyboard-aware variant.
const MOBILE_QUERY = '(max-width: 639px)'
// Gap kept between the dialog's top edge and the visible viewport.
const VIEWPORT_GAP = 12
// Only a hairline is kept above the keyboard — that space sits right where the
// keyboard already is, so it's better spent on the results list.
const KEYBOARD_GAP = 4

const useIsMobile = () => {
  const [isMobile, setIsMobile] = React.useState(false)
  React.useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY)
    const update = () => setIsMobile(mql.matches)
    update()
    mql.addEventListener('change', update)
    return () => mql.removeEventListener('change', update)
  }, [])
  return isMobile
}

const CommandDialog = ({
  children,
  open,
  onOpenChange,
  defaultOpen,
  modal,
  ...commandProps
}: CommandDialogProps) => {
  const isMobile = useIsMobile()
  const viewport = useVisualViewport(!!open && isMobile)

  // On mobile, pin the dialog to the top of the *visible* viewport and cap its
  // height to what's above the on-screen keyboard, so the input is never hidden
  // and the results scroll within reach. We hug the top with the same small gap
  // in both keyboard states — a percentage drop wasted a visible band above the
  // dialog and cost the results list height it could otherwise use.
  const keyboardAware = isMobile && viewport.ready
  const topPx = VIEWPORT_GAP
  const contentStyle: React.CSSProperties | undefined = keyboardAware
    ? {
        top: viewport.offsetTop + topPx,
        maxHeight: viewport.height - topPx - KEYBOARD_GAP,
      }
    : undefined

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      defaultOpen={defaultOpen}
      modal={modal}
    >
      <DialogContent
        style={contentStyle}
        className={cn(
          'top-[7vh] w-[calc(100%-1.5rem)] max-w-xl translate-y-0 overflow-hidden rounded-xl p-0 shadow-2xl sm:w-full sm:max-w-xl sm:rounded-xl lg:top-[9vh]',
          // A flex column lets the list grow into the remaining height and
          // scroll, keeping the input pinned at the top above the keyboard.
          keyboardAware && 'flex flex-col'
        )}
      >
        <VisuallyHidden.Root>
          <DialogTitle>Search</DialogTitle>
        </VisuallyHidden.Root>
        <Command
          className="min-h-0 flex-1 [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group]]:px-2 [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5"
          {...commandProps}
        >
          {children}
        </Command>
      </DialogContent>
    </Dialog>
  )
}

const CommandInput = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Input>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input> & {
    isLoading?: boolean
  }
>(({ isLoading, className, ...props }, ref) => (
  <div className="flex items-center border-b px-3" cmdk-input-wrapper="">
    {isLoading ? (
      <Loader className="mr-2 h-4 w-4 shrink-0 animate-spin opacity-50" />
    ) : (
      <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
    )}
    <CommandPrimitive.Input
      ref={ref}
      className={cn(
        'placeholder:text-muted-foreground flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-hidden disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  </div>
))

CommandInput.displayName = CommandPrimitive.Input.displayName

const CommandList = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.List
    ref={ref}
    className={cn('max-h-[300px] overflow-x-hidden overflow-y-auto', className)}
    {...props}
  />
))

CommandList.displayName = CommandPrimitive.List.displayName

const CommandEmpty = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Empty>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>((props, ref) => (
  <CommandPrimitive.Empty
    ref={ref}
    className="py-6 text-center text-sm"
    {...props}
  />
))

CommandEmpty.displayName = CommandPrimitive.Empty.displayName

const CommandGroup = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Group>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Group
    ref={ref}
    className={cn(
      'text-foreground [&_[cmdk-group-heading]]:text-muted-foreground overflow-hidden p-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium',
      className
    )}
    {...props}
  />
))

CommandGroup.displayName = CommandPrimitive.Group.displayName

const CommandSeparator = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Separator
    ref={ref}
    className={cn('bg-border -mx-1 h-px', className)}
    {...props}
  />
))
CommandSeparator.displayName = CommandPrimitive.Separator.displayName

const CommandItem = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Item
    ref={ref}
    className={cn(
      'aria-selected:bg-accent aria-selected:text-accent-foreground relative flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50',
      className
    )}
    {...props}
  />
))

CommandItem.displayName = CommandPrimitive.Item.displayName

const CommandShortcut = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => {
  return (
    <span
      className={cn(
        'text-muted-foreground ml-auto text-xs tracking-widest',
        className
      )}
      {...props}
    />
  )
}
CommandShortcut.displayName = 'CommandShortcut'

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
  type DialogProps as CommandDialogProps,
}
