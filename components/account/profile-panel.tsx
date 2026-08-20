'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Copy, ExternalLink } from 'lucide-react'

import { normaliseHandle } from '@/lib/profile/routes'
import { useAccount } from '@/hooks/use-account'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'

import { SettingSwitch } from './controls'
import { SupporterGate } from './supporter-gate'

interface Settings {
  handle: string | null
  published: boolean
  bio: string | null
}

const MAX_BIO = 160

/**
 * The public half of an account: a name, a line, and a switch.
 *
 * The switch is the whole feature. Everything on the page it controls already
 * exists — the library, the ratings, the published lists — so this panel writes
 * three fields and nothing else, and the page at /u/<handle> is assembled from
 * rows that were there anyway.
 */
export function ProfilePanel() {
  const { pro } = useAccount()
  const [settings, setSettings] = useState<Settings | null>(null)
  const [handle, setHandle] = useState('')
  const [bio, setBio] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const apply = useCallback((next: Settings) => {
    setSettings(next)
    setBio(next.bio ?? '')
  }, [])

  useEffect(() => {
    if (!pro) return
    const load = async () => {
      try {
        const response = await fetch('/api/profile')
        if (!response.ok) return
        const data = await response.json()
        if (data?.success) apply(data as Settings)
      } catch {
        setError('Could not reach the server.')
      }
    }
    void load()
  }, [apply, pro])

  const send = useCallback(
    async (body: Record<string, unknown>) => {
      setBusy(true)
      setError(null)
      try {
        const response = await fetch('/api/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const data = await response.json().catch(() => null)
        if (!response.ok || data?.success !== true) {
          setError(data?.error ?? 'That did not save. Try again.')
          return
        }
        apply(data as Settings)
      } catch {
        setError('Could not reach the server.')
      } finally {
        setBusy(false)
      }
    },
    [apply]
  )

  if (!pro) {
    return (
      <SupporterGate title="A page of your own" surface="account_profile">
        One address — reely.space/your-name — with everything you have finished,
        the titles you rated highest and every list you published. It is the one
        page here you can send to somebody who has never heard of Reely.
      </SupporterGate>
    )
  }

  if (!settings) {
    return (
      <div aria-hidden className="max-w-xl space-y-4">
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
    )
  }

  const url = settings.handle
    ? `${window.location.origin}/u/${settings.handle}`
    : null
  const wanted = normaliseHandle(handle)

  return (
    <div className="max-w-xl space-y-8">
      {settings.handle ? (
        <section className="space-y-3">
          <Label>Your address</Label>
          <div className="flex flex-wrap items-center gap-2">
            <code className="bg-muted min-w-0 flex-1 truncate rounded-md px-3 py-2 text-sm">
              {url}
            </code>
            <Button
              variant="outline"
              size="icon"
              aria-label="Copy your profile link"
              onClick={() => {
                void navigator.clipboard?.writeText(url ?? '')
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              }}
            >
              {copied ? (
                <Check className="size-4" />
              ) : (
                <Copy className="size-4" />
              )}
            </Button>
            <Button variant="outline" size="icon" asChild>
              <a
                href={url ?? '#'}
                target="_blank"
                rel="noreferrer"
                aria-label="Open your profile"
              >
                <ExternalLink className="size-4" />
              </a>
            </Button>
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Names are kept for good. This one is a link people may already have
            saved, so it is not something to swap around.
          </p>
        </section>
      ) : (
        <section className="space-y-3">
          <Label htmlFor="profile-handle">Pick your name</Label>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground text-sm">
              reely.space/u/
            </span>
            <Input
              id="profile-handle"
              value={handle}
              maxLength={20}
              autoCapitalize="none"
              spellCheck={false}
              placeholder="your-name"
              onChange={(event) => setHandle(event.target.value)}
              className="w-48"
            />
            <Button
              disabled={busy || !wanted}
              onClick={() => void send({ handle: wanted })}
            >
              Claim
            </Button>
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Three to twenty characters: letters, numbers and single dashes. You
            get one, and it is yours for good — so pick the one you would put on
            a business card.
          </p>
        </section>
      )}

      <section className="space-y-3">
        <Label htmlFor="profile-bio">A line about you</Label>
        <Input
          id="profile-bio"
          value={bio}
          maxLength={MAX_BIO}
          placeholder="Horror, mostly. Ask me about 1970s Italian cinema."
          onChange={(event) => setBio(event.target.value)}
          onBlur={() => {
            if (bio.trim() === (settings.bio ?? '')) return
            void send({ bio })
          }}
        />
        <p className="text-muted-foreground text-xs">
          {MAX_BIO - bio.length} characters left. Saved when you click away.
        </p>
      </section>

      <SettingSwitch
        label="Publish the page"
        description="Off, and the address answers as if nobody is there. On, and anyone with the link sees your counts, your highest-rated titles and your published lists. Never your watchlist, your history or your email."
        checked={settings.published}
        disabled={busy || !settings.handle}
        onChange={(next) => void send({ published: next })}
      />

      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  )
}
