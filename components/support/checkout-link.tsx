'use client'

import * as React from 'react'

import { proMailto, type ProPlan } from '@/config/support'
import { signInHref } from '@/lib/account'
import { trackCheckoutStarted } from '@/lib/analytics'
import { useAccountIdentity } from '@/hooks/use-account'

const PLAN_KEY = {
  Monthly: 'monthly',
  Yearly: 'yearly',
  Lifetime: 'lifetime',
  'Any plan': 'any',
} as const satisfies Record<ProPlan, string>

/**
 * The button that asks for Pro, and the one sentence that decides whether Pro
 * ever reaches an account.
 *
 * Pro is arranged by email for now (config/support.ts): the button opens a mail
 * that already names the plan and, when we know it, the sign-in address, because
 * Pro is switched on for an EMAIL and a request that does not name one costs a
 * round trip. The hint under the button says so at the moment of asking.
 */
export function CheckoutLink({
  className,
  children,
  surface,
  plan = 'Any plan',
  hint = true,
}: {
  className?: string
  children: React.ReactNode
  surface: string
  plan?: ProPlan
  /** Off where the layout places `CheckoutHint` itself. */
  hint?: boolean
}) {
  const { signedIn, email } = useAccountIdentity()

  return (
    <span className="inline-flex flex-col items-start gap-1.5">
      <a
        href={proMailto(plan, signedIn ? email : null)}
        className={className}
        onClick={() => {
          trackCheckoutStarted({
            plan: PLAN_KEY[plan],
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
        Pro is switched on for{' '}
        <span className="font-medium break-all text-foreground">{email}</span>{' '}
        once you have paid. The instant reply has the payment link.
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
      (free), so the email names the account Pro goes on.
    </span>
  )
}
