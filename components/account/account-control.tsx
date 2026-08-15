'use client'

import Link from 'next/link'
import { LogOut, User2 } from 'lucide-react'

import { signOut } from '@/lib/account'
import { cn } from '@/lib/utils'
import { useAccountIdentity, useAccountSession } from '@/hooks/use-account'
import { buttonVariants } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  AccountAvatar,
  accountMenuFor,
} from '@/components/account/account-identity'

/**
 * The header's account control, and the one component on the page that keeps
 * account state fresh (`useAccountSession`). It is in the root layout, so
 * everything else reads the answer it already fetched.
 *
 * Two constraints shape this, and both come from properties the site already
 * protects.
 *
 * **It must cost zero requests per page view.** Every page here is a static
 * asset matched before the Worker runs, which is what keeps page views off both
 * the CPU budget and the 100k/day cap. So it paints from a script-readable hint
 * cookie plus a cached profile in localStorage, and only refreshes the session
 * when a browser actually has one.
 *
 * **It must not flash or shift.** The header is prerendered, so signed-in state
 * cannot be server-rendered. Rendering "sign in" first and swapping to an avatar
 * is a visible flicker and a layout shift. The control therefore occupies a
 * fixed 40px slot that renders empty until the first client pass answers.
 */
export function AccountControl() {
  useAccountSession()
  const { ready, signedIn, name, email, picture, pro } = useAccountIdentity()

  if (!ready) {
    return <div aria-hidden className="size-10 shrink-0" />
  }

  if (!signedIn) {
    return (
      <Link
        href="/account"
        className={cn(
          buttonVariants({ size: 'icon', variant: 'ghost' }),
          'shrink-0'
        )}
      >
        <User2 className="size-5" />
        <span className="sr-only">Sign in</span>
      </Link>
    )
  }

  return (
    <Popover>
      <PopoverTrigger
        aria-label="Your account"
        className={cn(
          buttonVariants({ size: 'icon', variant: 'ghost' }),
          'relative shrink-0'
        )}
      >
        <AccountAvatar name={name} email={email} picture={picture} />
        {pro && (
          // The supporter mark. A ring rather than a badge with a word in it:
          // the header has room for neither, and this is for the owner of the
          // account, who already knows what it means.
          <span
            aria-hidden
            className="border-background bg-primary absolute right-1 bottom-1 size-2.5 rounded-full border-2"
          />
        )}
        <span className="sr-only">Your account</span>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-64 p-2">
        <div className="flex items-center gap-3 px-2 py-2">
          <AccountAvatar
            name={name}
            email={email}
            picture={picture}
            size="lg"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {name ?? 'Signed in'}
            </p>
            <p className="text-muted-foreground truncate text-xs">{email}</p>
          </div>
        </div>

        <div className="bg-border my-1 h-px" />

        {accountMenuFor(pro).map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className="hover:bg-accent focus-visible:bg-accent flex w-full items-center gap-3 rounded-sm px-2 py-2 text-sm outline-hidden"
          >
            <Icon className="size-4 shrink-0" />
            {label}
          </Link>
        ))}

        <div className="bg-border my-1 h-px" />

        <button
          type="button"
          onClick={() => void signOut()}
          className="hover:bg-accent focus-visible:bg-accent flex w-full items-center gap-3 rounded-sm px-2 py-2 text-left text-sm outline-hidden"
        >
          <LogOut className="size-4 shrink-0" />
          Sign out
        </button>
      </PopoverContent>
    </Popover>
  )
}
