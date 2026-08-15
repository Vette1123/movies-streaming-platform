'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bell, BellOff, Loader2 } from 'lucide-react'

import { savePrefs } from '@/lib/account'
import { base64UrlDecode } from '@/lib/token'
import { useAccount } from '@/hooks/use-account'
import { Button } from '@/components/ui/button'

import { SupporterGate } from './supporter-gate'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

type State = 'unsupported' | 'off' | 'on' | 'blocked' | 'busy'

/**
 * New-episode alerts.
 *
 * Two switches have to agree for anything to arrive, and the UI is honest about
 * both: this browser has to hold a push subscription, and the account has to
 * have alerts turned on (which is the flag the hourly sweep actually queries).
 * Turning it off here removes the subscription rather than leaving a dead
 * endpoint on the server for the sweep to keep trying.
 */
export function AlertsPanel() {
  const { pro, prefs } = useAccount()
  const [state, setState] = useState<State>('busy')
  const [error, setError] = useState<string | null>(null)

  const sync = useCallback(async () => {
    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator) ||
      !('PushManager' in window) ||
      !VAPID_PUBLIC_KEY
    ) {
      setState('unsupported')
      return
    }
    if (Notification.permission === 'denied') {
      setState('blocked')
      return
    }
    const registration = await navigator.serviceWorker.getRegistration()
    const subscription = await registration?.pushManager.getSubscription()
    setState(subscription ? 'on' : 'off')
  }, [])

  useEffect(() => {
    if (!pro) return
    // Reading the browser's notification permission and its push subscription is
    // exactly the "subscribe to an external system" case an effect is for; the
    // rule fires only because `sync` settles synchronously when permission is
    // already decided.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void sync()
  }, [pro, sync])

  const enable = async () => {
    setState('busy')
    setError(null)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'blocked' : 'off')
        return
      }

      // `ready` rather than `getRegistration`: the first visit may still be
      // installing the worker, and subscribing against a registration that is
      // not active yet throws.
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.subscribe({
        // Required by every browser, and the reason the service worker always
        // shows something: a push that displays nothing loses the permission.
        userVisibleOnly: true,
        applicationServerKey: base64UrlDecode(VAPID_PUBLIC_KEY),
      })

      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      })
      if (!response.ok) {
        await subscription.unsubscribe()
        setError('Could not register this device. Try again.')
        setState('off')
        return
      }

      await savePrefs({ alerts: true })
      setState('on')
    } catch {
      setError('This browser refused to set up notifications.')
      setState('off')
    }
  }

  const disable = async () => {
    setState('busy')
    try {
      const registration = await navigator.serviceWorker.getRegistration()
      const subscription = await registration?.pushManager.getSubscription()
      if (subscription) {
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: subscription.endpoint,
            unsubscribe: true,
          }),
        })
        await subscription.unsubscribe()
      }
      await savePrefs({ alerts: false })
      setState('off')
    } catch {
      setState('off')
    }
  }

  if (!pro) {
    return (
      <SupporterGate title="Know when the next episode is out">
        Reely already knows what you are part-way through. Alerts turn that into
        a notification the day a new episode of anything on your watchlist airs,
        and the day a film you saved reaches its release date. Off by default,
        one switch, revocable.
      </SupporterGate>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">
            {state === 'on'
              ? 'Alerts are on for this device'
              : 'Alerts are off'}
          </p>
          <p className="text-muted-foreground mt-1 max-w-[60ch] text-sm leading-relaxed">
            {stateCopy(state, prefs.alerts === true)}
          </p>
        </div>

        {state === 'on' && (
          <Button variant="outline" onClick={() => void disable()}>
            <BellOff className="mr-2 size-4" />
            Turn off
          </Button>
        )}
        {state === 'off' && (
          <Button onClick={() => void enable()}>
            <Bell className="mr-2 size-4" />
            Turn on
          </Button>
        )}
        {state === 'busy' && (
          <Button variant="outline" disabled>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Working
          </Button>
        )}
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  )
}

function stateCopy(state: State, accountEnabled: boolean): string {
  if (state === 'unsupported') {
    return 'This browser cannot receive push notifications. Chrome, Edge and Firefox can, and so can Safari once Reely is added to the home screen.'
  }
  if (state === 'blocked') {
    return 'Notifications are blocked for this site in your browser settings. Allow them there and this switch will work.'
  }
  if (state === 'on') {
    return accountEnabled
      ? 'A new episode of anything on your watchlist, and release days for films you saved. Nothing else, ever.'
      : 'This device is registered, but alerts are switched off on your account. Turn them back on to start receiving them.'
  }
  return 'Turn these on to hear about new episodes of shows on your watchlist. Each device you use needs its own switch.'
}
