import { describe, expect, it } from 'vitest'

import { claimSupporterGrants } from '@/lib/billing/supporters'

interface Supporter {
  grants: string
  ends_at: number | null
}
interface User {
  grants: string | null
  pro_until: number | null
}

/** Just enough of D1 for the statements claimSupporterGrants issues. */
function fakeDb(supporter: Supporter | null, user: User) {
  const db = {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            async first() {
              if (sql.includes('FROM supporters')) return supporter
              if (sql.includes('FROM users')) return user
              throw new Error(`unexpected read: ${sql}`)
            },
            async run() {
              if (!sql.startsWith('UPDATE users')) {
                throw new Error(`unexpected write: ${sql}`)
              }
              user.grants = args[0] as string | null
              user.pro_until = args[1] as number | null
              return {}
            },
          }
        },
      }
    },
  }
  return db as unknown as D1Database
}

const UNTIL = 1_830_000_000_000

describe('claimSupporterGrants', () => {
  it('carries the end date of a one-year supporter onto the account', async () => {
    const user: User = { grants: null, pro_until: null }
    await claimSupporterGrants(
      fakeDb({ grants: 'pro', ends_at: UNTIL }, user),
      'u1',
      'A@x.com'
    )
    expect(user).toEqual({ grants: 'pro', pro_until: UNTIL })
  })

  it('clears an old end date when the supporter is now lifetime', async () => {
    const user: User = { grants: 'pro', pro_until: UNTIL }
    await claimSupporterGrants(
      fakeDb({ grants: 'pro', ends_at: null }, user),
      'u1',
      'a@x.com'
    )
    expect(user).toEqual({ grants: 'pro', pro_until: null })
  })

  it('keeps a grant it did not own', async () => {
    const user: User = { grants: 'beta', pro_until: null }
    await claimSupporterGrants(
      fakeDb({ grants: 'pro', ends_at: UNTIL }, user),
      'u1',
      'a@x.com'
    )
    expect(user).toEqual({ grants: 'beta,pro', pro_until: UNTIL })
  })
})
