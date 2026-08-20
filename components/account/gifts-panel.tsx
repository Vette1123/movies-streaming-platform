'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Copy, Gift, Plus, Users } from 'lucide-react'
import { toast } from 'sonner'

import { REFERRALS_PER_MONTH } from '@/lib/billing/gifts'
import { useAccount } from '@/hooks/use-account'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SkeletonRows } from '@/components/ui/skeleton'

interface GiftCode {
  code: string
  months: number
  created_at: number
  used: boolean
}

interface Overview {
  codes: GiftCode[]
  referrals: number
  earned: number
  toNext: number
}

/**
 * Two ways a month of supporter moves between people.
 *
 * Both are here rather than in two sections because they are the same idea from
 * two sides — you can hand somebody a month deliberately, or earn one by
 * bringing people in — and somebody looking for either is looking for this page.
 *
 * Redeeming is open to everyone, including people who have never paid. It has to
 * be: being given a month is how somebody finds out what they would be paying
 * for.
 */
export function GiftsPanel() {
  const { pro, signedIn } = useAccount()
  const [data, setData] = useState<Overview | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/gifts')
      if (!response.ok) {
        setData({
          codes: [],
          referrals: 0,
          earned: 0,
          toNext: REFERRALS_PER_MONTH,
        })
        return
      }
      setData((await response.json()) as Overview)
    } catch {
      setData({
        codes: [],
        referrals: 0,
        earned: 0,
        toNext: REFERRALS_PER_MONTH,
      })
    }
  }, [])

  useEffect(() => {
    if (signedIn !== true) return
    // Fetch-on-mount: the codes live on the server and there is nothing to show
    // until they arrive. The rule fires on the synchronous failure branch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load, signedIn])

  const send = useCallback(
    async (body: Record<string, unknown>): Promise<boolean> => {
      setBusy(true)
      try {
        const response = await fetch('/api/gifts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const payload = await response.json().catch(() => null)
        if (!response.ok || payload?.success !== true) {
          toast(payload?.error ?? 'That did not work. Try again.')
          return false
        }
        await load()
        return true
      } catch {
        toast('Could not reach the server.')
        return false
      } finally {
        setBusy(false)
      }
    },
    [load]
  )

  if (!data) return <SkeletonRows rows={3} />

  return (
    <div className="space-y-10">
      <Redeem
        busy={busy}
        onRedeem={(code) => send({ action: 'redeem', code })}
      />

      {pro && (
        <>
          <GiveAway
            codes={data.codes}
            busy={busy}
            onMint={() => send({ action: 'mint' })}
          />
          <Referrals
            referrals={data.referrals}
            earned={data.earned}
            toNext={data.toNext}
          />
        </>
      )}
    </div>
  )
}

function Redeem({
  busy,
  onRedeem,
}: {
  busy: boolean
  onRedeem: (code: string) => Promise<boolean>
}) {
  const [code, setCode] = useState('')

  return (
    <form
      className="space-y-3"
      onSubmit={async (event) => {
        event.preventDefault()
        const ok = await onRedeem(code)
        if (ok) {
          setCode('')
          toast('A month of supporter is on your account.')
        }
      }}
    >
      <Label htmlFor="gift-code">Got a code?</Label>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          id="gift-code"
          value={code}
          maxLength={16}
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="ABCD-EFGH-JK"
          onChange={(event) => setCode(event.target.value)}
          className="w-56 font-mono tracking-wider uppercase"
        />
        <Button type="submit" disabled={busy || code.trim().length < 10}>
          <Gift className="mr-2 size-4" />
          Redeem
        </Button>
      </div>
      <p className="text-muted-foreground max-w-[62ch] text-sm leading-relaxed">
        A month of everything supporters get, added on top of anything you
        already have. No card, nothing to cancel — when the month is up it
        simply stops.
      </p>
    </form>
  )
}

function GiveAway({
  codes,
  busy,
  onMint,
}: {
  codes: GiftCode[]
  busy: boolean
  onMint: () => Promise<boolean>
}) {
  const live = codes.filter((entry) => !entry.used)

  return (
    <section className="space-y-3 border-t pt-6">
      <div>
        <p className="text-sm font-medium">Give a month away</p>
        <p className="text-muted-foreground mt-1 max-w-[62ch] text-sm leading-relaxed">
          Mint a code and send it to whoever you keep telling about this. It
          costs you nothing and it does not touch your own support — it is the
          honest version of a referral link.
        </p>
      </div>

      {live.length > 0 && (
        <ul className="space-y-2">
          {live.map((entry) => (
            <li key={entry.code}>
              <CodeRow code={entry.code} />
            </li>
          ))}
        </ul>
      )}

      <Button variant="outline" disabled={busy} onClick={() => void onMint()}>
        <Plus className="mr-2 size-4" />
        New code
      </Button>

      {codes.some((entry) => entry.used) && (
        <p className="text-muted-foreground text-xs">
          {codes.filter((entry) => entry.used).length} of your codes have been
          used.
        </p>
      )}
    </section>
  )
}

function CodeRow({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="bg-muted rounded-md px-3 py-2 font-mono text-sm tracking-widest">
        {code}
      </code>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Copy ${code}`}
        onClick={() => {
          void navigator.clipboard?.writeText(code)
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        }}
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      </Button>
    </div>
  )
}

function Referrals({
  referrals,
  earned,
  toNext,
}: {
  referrals: number
  earned: number
  toNext: number
}) {
  return (
    <section className="space-y-3 border-t pt-6">
      <div>
        <p className="flex items-center gap-2 text-sm font-medium">
          <Users className="size-4" />
          People who joined from your page
        </p>
        <p className="text-muted-foreground mt-1 max-w-[62ch] text-sm leading-relaxed">
          Every {REFERRALS_PER_MONTH} sign-ups from your public page is a free
          month, added automatically. Nothing to claim and nothing to chase — it
          is on your account the moment the third person joins.
        </p>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
        <Figure value={referrals} label="signed up" />
        <Figure
          value={earned}
          label={earned === 1 ? 'month earned' : 'months earned'}
        />
        <p className="text-muted-foreground text-sm">
          {toNext} more for the next one.
        </p>
      </div>
    </section>
  )
}

function Figure({ value, label }: { value: number; label: string }) {
  return (
    <p className="flex items-baseline gap-2">
      <span className="font-mono text-2xl font-semibold tabular-nums">
        {value}
      </span>
      <span className="text-muted-foreground text-xs">{label}</span>
    </p>
  )
}
