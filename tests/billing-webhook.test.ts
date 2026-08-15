import { describe, expect, it } from 'vitest'

import {
  SUPPORT_LIFETIME,
  SUPPORT_MEMBERSHIP,
  SUPPORT_TAG,
} from '@/config/support'
import {
  BMC_LEVELS,
  isFresh,
  pickEmail,
  pickLevel,
  resolveLevel,
} from '@/lib/billing/bmc'
import { verifyWebhookSignature } from '@/lib/billing/hmac-webhook'

const SECRET = 'a-webhook-secret'

async function sign(body: string, secret = SECRET): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const mac = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(body)
  )
  return [...new Uint8Array(mac)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

describe('verifyWebhookSignature', () => {
  const body = JSON.stringify({ type: 'membership.started', data: { id: 1 } })

  it('accepts a genuine signature', async () => {
    expect(await verifyWebhookSignature(body, await sign(body), SECRET)).toBe(
      true
    )
  })

  it('accepts it with surrounding whitespace', async () => {
    const signature = `  ${await sign(body)}\n`
    expect(await verifyWebhookSignature(body, signature, SECRET)).toBe(true)
  })

  it('rejects a body that was edited after signing', async () => {
    const signature = await sign(body)
    const tampered = body.replace('"id":1', '"id":2')
    expect(await verifyWebhookSignature(tampered, signature, SECRET)).toBe(
      false
    )
  })

  it('rejects the wrong secret', async () => {
    const signature = await sign(body, 'someone-elses-secret')
    expect(await verifyWebhookSignature(body, signature, SECRET)).toBe(false)
  })

  it('rejects a missing or malformed signature without throwing', async () => {
    expect(await verifyWebhookSignature(body, null, SECRET)).toBe(false)
    expect(await verifyWebhookSignature(body, '', SECRET)).toBe(false)
    expect(await verifyWebhookSignature(body, 'zz', SECRET)).toBe(false)
    // Odd length: not decodable as hex at all.
    expect(await verifyWebhookSignature(body, 'abc', SECRET)).toBe(false)
  })
})

describe('pickEmail', () => {
  it('reads the payer address from either shape', () => {
    expect(pickEmail({ supporter_email: 'A@Example.COM' })).toBe(
      'a@example.com'
    )
    expect(pickEmail({ supporter: { email: 'b@example.com' } })).toBe(
      'b@example.com'
    )
  })

  it('refuses a value that is not an address', () => {
    expect(pickEmail({ supporter_email: 'not an email' })).toBeNull()
    expect(pickEmail({})).toBeNull()
  })
})

describe('pickLevel + resolveLevel', () => {
  // `secret` is part of the config the webhook handler takes; resolveLevel does
  // not read it, and a real one has no business in a test fixture.
  const config = { secret: 'unused-here', levels: BMC_LEVELS, fallback: null }

  it('grants on this project’s membership name', () => {
    const level = pickLevel({ level_name: SUPPORT_MEMBERSHIP })
    expect(resolveLevel(config, level)).toEqual({ grant: 'pro' })
  })

  it('marks the lifetime offer as a lifetime', () => {
    const level = pickLevel({ extra: { name: SUPPORT_LIFETIME } })
    expect(resolveLevel(config, level)).toEqual({
      grant: 'pro',
      lifetime: true,
    })
  })

  it('folds case, spacing and any dash the dashboard was typed with', () => {
    for (const dash of ['—', '-', '–', '  -  ']) {
      const typed = `${SUPPORT_TAG} ${dash} supporter`.toUpperCase()
      expect(resolveLevel(config, typed)).toEqual({ grant: 'pro' })
    }
  })

  it('ignores another project’s offer on the same account', () => {
    expect(resolveLevel(config, 'Social Downloader — Supporter')).toBeNull()
    expect(resolveLevel(config, 'A coffee')).toBeNull()
    expect(resolveLevel(config, null)).toBeNull()
  })

  it('does not read the supporter’s own name as an offer name', () => {
    expect(pickLevel({ name: SUPPORT_MEMBERSHIP })).toBeNull()
  })
})

describe('isFresh', () => {
  const stored = {
    grants: 'pro',
    lifetime: 0,
    event_id: 42,
    updated_at: 1000,
  }

  it('accepts anything for an address never seen before', () => {
    expect(isFresh(null, 1, 0)).toBe(true)
  })

  it('rejects a redelivery of the same event', () => {
    expect(isFresh(stored, 42, 5000)).toBe(false)
  })

  it('rejects an out-of-order delivery', () => {
    expect(isFresh(stored, 43, 999)).toBe(false)
  })

  it('accepts the same second, which the provider cannot order for us', () => {
    expect(isFresh(stored, 43, 1000)).toBe(true)
  })
})
