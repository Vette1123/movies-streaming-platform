'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { SUPPORT_EMAIL, supportMailto } from '@/config/support'
import { refreshAccount } from '@/lib/account'
import { checkoutPendingSince, clearCheckoutPending } from '@/lib/checkout'
import { useAccountIdentity } from '@/hooks/use-account'

/** Every 10s while the tab is on screen: a webhook usually lands inside a minute. */
const POLL_MS = 10_000
/** After this the honest message is "it has not arrived", not a spinner. */
const GIVE_UP_MS = 5 * 60 * 1000

/**
 * The tab somebody comes back to after paying.
 *
 * The payment opens Buy Me a Coffee in a new tab and lands through the webhook,
 * and this tab used to have no idea: it still showed the pitch to somebody who
 * had just paid, until they happened to reload. Now, after a checkout was
 * started here, coming back to the tab checks for the money every few seconds
 * and says so - and the page flips to the supporter view on its own the moment
 * it lands (PlanView reads the same account state).
 *
 * Polls only while the tab is visible and only for a few minutes: the whole
 * site is built to keep page views off the Worker.
 */
export function CheckoutWatcher() {
  const { ready, signedIn, pro, email } = useAccountIdentity()
  const [since, setSince] = React.useState<number | null>(null)
  const [gaveUp, setGaveUp] = React.useState(false)

  React.useEffect(() => {
    // localStorage has no server answer; the first client pass reads it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSince(checkoutPendingSince())
    const onFocus = () => setSince(checkoutPendingSince())
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  const watching = ready && since !== null && signedIn === true && !pro

  React.useEffect(() => {
    if (!watching || since === null) return
    const tick = () => {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - since > GIVE_UP_MS) {
        setGaveUp(true)
        return
      }
      void refreshAccount({ force: true })
    }
    tick()
    const id = window.setInterval(tick, POLL_MS)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [since, watching])

  // The money landed.
  React.useEffect(() => {
    if (!ready || !pro || since === null) return
    clearCheckoutPending()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSince(null)
    toast.success('You are a supporter. Thank you.', {
      description: 'Everything is switched on, on every device you sign in on.',
    })
  }, [pro, ready, since])

  if (!watching) return null

  return (
    <div role="status" className="container max-w-(--breakpoint-xl) pt-24">
      <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/10 p-4 text-sm">
        {gaveUp ? (
          <p className="leading-relaxed">
            Your payment has not reached this account yet. If you paid with an
            address other than{' '}
            <span className="font-medium">{email ?? 'your sign-in email'}</span>
            , email{' '}
            <a
              href={supportMailto(
                `Payment not linked (signed in as ${email ?? 'unknown'})`
              )}
              className="font-medium underline underline-offset-4"
            >
              {SUPPORT_EMAIL}
            </a>{' '}
            with the address you paid with, and it is moved across the same day.
          </p>
        ) : (
          <>
            <Loader2
              className="mt-0.5 size-4 shrink-0 animate-spin motion-reduce:animate-none"
              aria-hidden
            />
            <p className="leading-relaxed">
              Waiting for your payment to arrive. It usually takes under a
              minute, and this page switches over by itself.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
