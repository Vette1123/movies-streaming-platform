'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bell, BellOff, Loader2 } from 'lucide-react'

import { ALERT_REGIONS, DEFAULT_ALERT_REGION } from '@/config/regions'
import { savePrefs } from '@/lib/account'
import type { QuietHours } from '@/lib/push/quiet'
import { base64UrlDecode } from '@/lib/token'
import { useAccount } from '@/hooks/use-account'
import { Button } from '@/components/ui/button'

import { SettingSwitch } from './controls'
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

      <RegionSection region={prefs.region} />

      <PacingSection quiet={prefs.quiet} digest={prefs.digest === true} />
    </div>
  )
}

/** Whole hours only. Nobody sets a do-not-disturb window to 22:47. */
const HOURS = Array.from({ length: 24 }, (_, hour) => hour)

const hourLabel = (hour: number): string =>
  `${String(hour).padStart(2, '0')}:00`

/**
 * When to be quiet, and how often to be interrupted.
 *
 * Both of these only decide whether a device makes a noise. The alert itself is
 * written by the sweep regardless and is waiting in the app afterwards — which
 * is what makes this safe to offer at all, and is worth saying on screen,
 * because "quiet hours" reads like "lose the ones that happen overnight".
 *
 * The zone is taken from the browser rather than asked for: it is the one thing
 * here the device already knows for certain, and a Worker has no timezone
 * database to resolve a name with anyway.
 */
function PacingSection({
  quiet,
  digest,
}: {
  quiet?: QuietHours
  digest: boolean
}) {
  const [saving, setSaving] = useState(false)
  const [from, setFrom] = useState(quiet?.from ?? 23)
  const [to, setTo] = useState(quiet?.to ?? 8)
  const enabled = Boolean(quiet)

  const save = async (next: Record<string, unknown>) => {
    setSaving(true)
    await savePrefs(next)
    setSaving(false)
  }

  const writeWindow = (nextFrom: number, nextTo: number) => {
    setFrom(nextFrom)
    setTo(nextTo)
    if (nextFrom === nextTo) return
    void save({
      quiet: {
        from: nextFrom,
        to: nextTo,
        tz: -new Date().getTimezoneOffset(),
      },
    })
  }

  return (
    <div className="space-y-4 border-t pt-6">
      <div>
        <p className="text-sm font-medium">Quiet hours</p>
        <p className="text-muted-foreground mt-1 max-w-[65ch] text-sm leading-relaxed">
          Nothing buzzes between these two times. The alerts still arrive — they
          are waiting in Reely when you next open it — your phone just does not
          make a noise about an episode at 3am.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2">
          <span className="text-muted-foreground">From</span>
          <HourSelect
            value={from}
            disabled={saving}
            onChange={(hour) => writeWindow(hour, to)}
          />
        </label>
        <label className="flex items-center gap-2">
          <span className="text-muted-foreground">until</span>
          <HourSelect
            value={to}
            disabled={saving}
            onChange={(hour) => writeWindow(from, hour)}
          />
        </label>
        {enabled && (
          <Button
            variant="ghost"
            size="sm"
            disabled={saving}
            onClick={() => void save({ quiet: null })}
          >
            Turn off
          </Button>
        )}
        {saving && <Loader2 className="size-4 animate-spin" aria-hidden />}
      </div>

      <SettingSwitch
        label="One notification a day"
        description="Instead of one per episode. Everything that happened is collected in Reely and your phone is rung at most once in twenty hours — the right setting for a watchlist with a lot on it."
        checked={digest}
        disabled={saving}
        onChange={(next) => void save({ digest: next })}
      />
    </div>
  )
}

function HourSelect({
  value,
  disabled,
  onChange,
}: {
  value: number
  disabled: boolean
  onChange: (hour: number) => void
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(Number(event.target.value))}
      className="border-input bg-background focus-visible:ring-ring rounded-md border px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-hidden disabled:opacity-60"
    >
      {HOURS.map((hour) => (
        <option key={hour} value={hour}>
          {hourLabel(hour)}
        </option>
      ))}
    </select>
  )
}

/**
 * Which country "now streaming" alerts are about.
 *
 * It has to be asked rather than detected. A static export has no request-time
 * geo, and a browser locale is not a country — `en-US` is the default on half
 * the phones on earth. Guessing wrong here does not degrade the feature, it
 * inverts it: somebody is told a title landed on a service they cannot buy.
 *
 * So the alert stays silent until this is set, and the sweep reads the answer
 * (lib/push/sweep.ts, regionOf) rather than assuming one.
 */
function RegionSection({ region }: { region?: string }) {
  const [saving, setSaving] = useState(false)
  const [value, setValue] = useState(region ?? '')

  const choose = async (next: string) => {
    setValue(next)
    setSaving(true)
    await savePrefs({ region: next })
    setSaving(false)
  }

  return (
    <div className="space-y-3 border-t pt-6">
      <div>
        <p className="text-sm font-medium">Tell me when it starts streaming</p>
        <p className="text-muted-foreground mt-1 max-w-[65ch] text-sm leading-relaxed">
          A notification when something on your watchlist lands on a
          subscription service you could already be paying for. It is per
          country, so it needs one, and Reely will not guess: nothing is sent
          until you pick.{' '}
          {value
            ? 'Rentals and purchases are never counted, because a film has been rentable since release and that is not news.'
            : 'Rentals and purchases are never counted.'}
        </p>
      </div>
      <label className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-muted-foreground">Country</span>
        <select
          value={value}
          disabled={saving}
          onChange={(event) => void choose(event.target.value)}
          className="border-input bg-background focus-visible:ring-ring rounded-md border px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-hidden disabled:opacity-60"
        >
          <option value="" disabled>
            Choose a country
          </option>
          {ALERT_REGIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        {saving && <Loader2 className="size-4 animate-spin" aria-hidden />}
      </label>
      {!value && (
        <p className="text-muted-foreground text-xs">
          Most people here pick{' '}
          {ALERT_REGIONS.find((r) => r.id === DEFAULT_ALERT_REGION)?.label}.
        </p>
      )}
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
