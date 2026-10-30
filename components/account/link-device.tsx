'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'

import { signInHref } from '@/lib/account'
import { trackApiError, trackFeatureUsed } from '@/lib/analytics'
import { normaliseUserCode } from '@/lib/auth/device-code'
import { useAccountIdentity } from '@/hooks/use-account'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Icons } from '@/components/icons'

const CODE_INPUT_ID = 'tv-code'

const Heading = ({ title, body }: { title: string; body: string }) => (
  <div className="space-y-3">
    <h1 className="text-3xl font-semibold tracking-tight text-balance">
      {title}
    </h1>
    <p className="leading-relaxed text-pretty text-muted-foreground">{body}</p>
  </div>
)

function SignInFirst() {
  return (
    <div className="space-y-6">
      <Heading
        title="Link your TV"
        body="Sign in to the account you support Reely with, then enter the code on your TV."
      />
      <a href={signInHref('/link')} className={buttonVariants({ size: 'lg' })}>
        <Icons.google className="mr-2 size-4" />
        Continue with Google
      </a>
    </div>
  )
}

function SupportersOnly() {
  return (
    <div className="space-y-6">
      <Heading
        title="Linking a TV is for supporters"
        body="The Reely Player on Kodi comes with supporting Reely. Once you do, this page will take your code."
      />
      <Link href="/support" className={buttonVariants({ size: 'lg' })}>
        Support Reely
      </Link>
    </div>
  )
}

function Linked() {
  return (
    <div role="status">
      <Heading
        title="Your TV is linked"
        body="It will pick this up in a few seconds. You can put your phone down."
      />
    </div>
  )
}

/** What to tell someone whose code was refused, from the Worker's answer. */
async function approveCode(code: string): Promise<string | null> {
  try {
    const response = await fetch('/api/device/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })
    if (response.ok) return null
    const body = await response.json().catch(() => null)
    return body?.error ?? 'That did not work. Try again.'
  } catch (error) {
    trackApiError({
      source: 'device_link',
      message: String(error),
      expected: true,
    })
    return 'Could not reach Reely. Check your connection and try again.'
  }
}

function CodeForm({ onLinked }: { onLinked: () => void }) {
  const [code, setCode] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!normaliseUserCode(code)) {
      setError('Codes have 8 characters, like BCDF-2345.')
      return
    }
    setSending(true)
    setError(null)
    const refusal = await approveCode(code)
    setSending(false)
    trackFeatureUsed({
      feature: 'tv_link',
      action: 'approved',
      outcome: refusal ? 'failed' : 'ok',
    })
    if (refusal) {
      setError(refusal)
      return
    }
    onLinked()
  }

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <Heading
        title="Link your TV"
        body="Open Reely in Kodi, choose Link this TV, and enter the code it shows."
      />
      <div className="space-y-2">
        <label htmlFor={CODE_INPUT_ID} className="text-sm font-medium">
          Code on your TV
        </label>
        <Input
          id={CODE_INPUT_ID}
          value={code}
          onChange={(event) => {
            setCode(event.target.value.toUpperCase())
            setError(null)
          }}
          placeholder="BCDF-2345"
          autoComplete="off"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          maxLength={12}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${CODE_INPUT_ID}-error` : undefined}
          className="h-14 text-center font-mono text-2xl tracking-[0.15em] tabular-nums md:text-2xl"
        />
        {error && (
          <p
            id={`${CODE_INPUT_ID}-error`}
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
          >
            {error}
          </p>
        )}
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={sending}>
        {sending ? 'Linking…' : 'Link TV'}
      </Button>
      <p className="text-sm text-muted-foreground">
        No add-on yet?{' '}
        <a
          href="/kodi/plugin.video.reely.zip"
          download
          className="underline underline-offset-4 hover:text-foreground"
        >
          Download it for Kodi
        </a>
        . It needs Kodi 19 or newer.
      </p>
    </form>
  )
}

export function LinkDevice() {
  const { ready, signedIn, pro } = useAccountIdentity()
  const [linked, setLinked] = useState(false)

  if (!ready) return null
  if (linked) return <Linked />
  if (!signedIn) return <SignInFirst />
  if (!pro) return <SupportersOnly />
  return <CodeForm onLinked={() => setLinked(true)} />
}
