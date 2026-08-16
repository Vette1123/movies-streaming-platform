import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex cursor-pointer items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-primary-fill text-primary-foreground hover:bg-primary-fill/90',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline:
          'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
        'animated-watch-now':
          'bg-primary text-secondary-foreground text-2xl font-medium font-sans hover:scale-105 transition-transform animate-border bg-linear-to-r from-red-500 via-purple-500 to-blue-500 bg-size-[400%_400%]',
        watchNow:
          'bg-primary text-secondary-foreground text-xl font-bold font-sans hover:scale-105 transition-transform',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        text: 'h-auto px-2',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
        '2xl': 'h-11 rounded-md px-12',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        // A bare <button> inside a <form> is a SUBMIT button, and submitting a
        // form with no action reloads the page — which looks exactly like the
        // app crashing and reopening. Every button here is an app control
        // unless it says otherwise, so the safe default belongs at the bottom
        // rather than on each of the callers that happens to sit in a form.
        // `asChild` renders somebody else's element, which may not be a button
        // at all, so the attribute is only forced when we own the tag.
        type={asChild ? type : (type ?? 'button')}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
