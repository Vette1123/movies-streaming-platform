'use client'

import * as React from 'react'

import { SUPPORT_URL } from '@/config/support'
import { signInHref } from '@/lib/account'
import { trackCheckoutStarted } from '@/lib/analytics'
import { markCheckoutPending } from '@/lib/checkout'
import { useAccountIdentity } from '@/hooks/use-account'

/**
 * The link that leaves for the payment page, and the one sentence that decides
 * whether the payment ever reaches an account.
 *
 * Support switches on for the email the payment was made with. The most common
 * support mail was somebody who paid under one address and signed in with
 * another, and the reason was that the only place saying so was step two of a
 * section most people never scroll to. So it is said here, under the button,
 * at the moment of paying - with the actual address when we know it.
 */
export function CheckoutLink({
  className,
  children,
  surface,
  hint = true,
}: {
  className?: string
  children: React.ReactNode
  surface: string
  /** Off where the layout places `CheckoutHint` itself. */
  hint?: boolean
}) {
  const { signedIn } = useAccountIdentity()

  return (
    <span className="inline-flex flex-col items-start gap-1.5">
      <a
        href={SUPPORT_URL}
        target="_blank"
        rel="noreferrer"
        className={className}
        onClick={() => {
          markCheckoutPending()
          trackCheckoutStarted({
            plan: 'any',
            signedIn: signedIn === true,
            surface,
          })
        }}
      >
        {children}
      </a>
      {hint && <CheckoutHint />}
    </span>
  )
}

/** The email sentence on its own, for a row of several buttons. */
export function CheckoutHint() {
  const { ready, signedIn, email } = useAccountIdentity()
  if (!ready) return null
  return <EmailHint signedIn={signedIn === true} email={email} />
}

function EmailHint({
  signedIn,
  email,
}: {
  signedIn: boolean
  email: string | null
}) {
  if (signedIn && email) {
    return (
      <span className="text-xs text-muted-foreground">
        Pay with <span className="font-medium text-foreground">{email}</span>{' '}
        and it switches on here by itself.
      </span>
    )
  }
  return (
    <span className="text-xs text-muted-foreground">
      <a
        href={signInHref('/support')}
        className="font-medium text-foreground underline underline-offset-4"
      >
        Sign in first
      </a>{' '}
      (free), then pay with the same email so it lands on your account.
    </span>
  )
}
