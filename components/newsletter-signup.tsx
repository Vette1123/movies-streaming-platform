'use client'

import React, { useState } from 'react'

import { Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { trackNewsletterSubscribed } from '@/lib/analytics'

interface NewsletterSignupProps {
  className?: string
}

export function NewsletterSignup({ className }: NewsletterSignupProps) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitting' | 'ok' | 'error'>('idle')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    setStatus('submitting')
    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'footer' }),
      })
      if (res.ok || res.status === 202) {
        setStatus('ok')
        trackNewsletterSubscribed({ source: 'footer' })
      } else {
        setStatus('error')
      }
    } catch {
      setStatus('error')
    }
  }

  return (
    <section className={cn('space-y-3', className)}>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Mail className="size-4 text-muted-foreground" />
          <span className="text-xs font-semibold tracking-wider text-foreground uppercase">
            Newsletter
          </span>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          One email a week: what&apos;s trending, what&apos;s new, and what&apos;s worth your
          time. No spam, unsubscribe anytime.
        </p>
        <form onSubmit={handleSubmit} className="flex gap-2 sm:flex-row">
          <Label htmlFor="newsletter-email" className="sr-only">
            Email address
          </Label>
          <Input
            id="newsletter-email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={status === 'submitting'}
            className="flex-1 text-sm"
          />
          <Button
            type="submit"
            disabled={status === 'submitting' || !email}
            className="text-sm"
          >
            {status === 'submitting' ? '…' : 'Subscribe'}
          </Button>
        </form>
        {status === 'ok' && (
          <p className="text-xs text-emerald-400">
            You&apos;re on the list — watch your inbox.
          </p>
        )}
        {status === 'error' && (
          <p className="text-xs text-destructive">
            Something went wrong. Try again.
          </p>
        )}
      </div>
    </section>
  )
}
