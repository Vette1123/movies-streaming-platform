/**
 * A personal invite link for every account, supporter or not.
 *
 * Referrals used to ride on the public profile page, which only supporters
 * have, so the people with the most reason to bring friends in (free users one
 * month away from trying everything) had no link to share. This code is that
 * link: `/?invite=<code>` writes the same `reely_ref` cookie a profile page
 * does, and the auth callback credits whoever it names.
 *
 * Pure and dependency-free so the browser can validate a link before writing
 * the cookie without pulling any Worker code into the bundle.
 */

/** Underscore can never appear in a handle, so the two never collide. */
const PREFIX = 'inv_'
/** No 0/O, no 1/l: it may be read aloud. */
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'
const LENGTH = 10
const PATTERN = new RegExp(`^${PREFIX}[${ALPHABET}]{${LENGTH}}$`)

/** The query parameter an invite link carries. */
export const INVITE_PARAM = 'invite'

export function mintInviteCode(random: () => number = Math.random): string {
  let code = PREFIX
  for (let i = 0; i < LENGTH; i++) {
    code += ALPHABET[Math.floor(random() * ALPHABET.length)]
  }
  return code
}

/** What a link or cookie carried, as an invite code — or null. */
export function parseInviteCode(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const code = value.trim().toLowerCase()
  return PATTERN.test(code) ? code : null
}

/** The path somebody shares; `useShare` puts the site origin in front. */
export function invitePath(code: string): string {
  return `/?${INVITE_PARAM}=${code}`
}
