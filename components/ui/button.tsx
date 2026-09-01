import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex cursor-pointer items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
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
        // The hero's primary action. `text-secondary-foreground` here was
        // near-white in dark mode, which is fine on Reely's blue and wrong on
        // three of the five supporter accents: ember, ocean and forest are light
        // enough that the token comment in styles/globals.css sets
        // `--primary-foreground` dark on purpose. Pairing the accent background
        // with the accent's own foreground is the pair that comment describes,
        // and it is the only one that holds AA across all six palettes.
        watchNow:
          'bg-primary-fill font-sans text-xl font-bold text-primary-foreground transition-transform hover:scale-105',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        // tap-target, not min-h-6: on compact density the root is 15px and a
        // spacing step is 3.75px, so 6 lands on 22.5. The label's own line box
        // is 23. See the utility in styles/globals.css.
        text: 'tap-target h-auto px-2',
        lg: 'h-11 rounded-md px-8',
        icon: 'size-10',
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
