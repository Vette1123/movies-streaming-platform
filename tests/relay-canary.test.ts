import { describe, expect, it } from 'vitest'

import {
  selftestPassed,
  selftestReason,
  verdict,
} from '../scripts/relay-canary.mjs'

const walked = {
  ok: true,
  master: { bytes: 900, isM3U: true },
  segment: { status: 200, bytes: 512000, ms: 300 },
}
const pass = { ok: true }
const fail = { ok: false }

describe('relay canary', () => {
  it('passes a walk only when it reached a real segment', () => {
    expect(selftestPassed(walked)).toBe(true)
    expect(selftestPassed({ ...walked, segment: { status: 403 } })).toBe(false)
    expect(selftestPassed({ ...walked, segment: undefined })).toBe(false)
    expect(selftestPassed({ ...walked, master: { isM3U: false } })).toBe(false)
    expect(selftestPassed(undefined)).toBe(false)
  })

  it("names the provider's refusal, the way the Nov 7 outage read", () => {
    const error =
      'Error: no usable stream url (Error: /generate.php -> 403 "invalid or mismatched api token" len=31 server=cloudflare)'
    expect(selftestReason({ ok: false, error })).toBe(error)
    expect(selftestReason({ ok: false, coolingFor: 80 })).toBe(
      'rate-limited, cooling 80s'
    )
  })

  it('fails when every title fails, as in a provider-wide break', () => {
    expect(verdict([pass, pass], [fail, fail, fail]).ok).toBe(false)
  })

  it('tolerates one title leaving the catalog', () => {
    expect(verdict([pass, pass], [pass, fail, pass]).ok).toBe(true)
    expect(verdict([pass, pass], [fail, fail, pass]).ok).toBe(false)
  })

  it('fails when the site or player layer is down, whatever the titles say', () => {
    expect(verdict([fail, pass], [pass, pass, pass]).ok).toBe(false)
    expect(verdict([pass, fail], [pass, pass, pass]).ok).toBe(false)
  })
})
