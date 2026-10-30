/**
 * The code a TV shows and a person types. Split from device.ts because /link
 * validates with it in the browser, and device.ts carries the session code.
 */

/** No vowels (no accidental words), and no 0/O or 1/I to misread off a TV. */
const CODE_ALPHABET = 'BCDFGHJKLMNPQRSTVWXZ23456789'
export const USER_CODE_LENGTH = 8

/** Eight characters from the alphabet, from any source of random bytes. */
export function mintUserCode(bytes: Uint8Array): string {
  return Array.from(
    bytes.slice(0, USER_CODE_LENGTH),
    (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]
  ).join('')
}

/**
 * The code as stored, or null. Forgiving about what people type (case, the
 * dash the TV shows, spaces), strict about everything else: this reaches a
 * query.
 */
export function normaliseUserCode(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const code = input.toUpperCase().replace(/[\s-]/g, '')
  if (code.length !== USER_CODE_LENGTH) return null
  return [...code].every((char) => CODE_ALPHABET.includes(char)) ? code : null
}

/** `ABCD-EFGH`: eight characters are easier to copy off a screen in two. */
export const formatUserCode = (code: string): string =>
  `${code.slice(0, 4)}-${code.slice(4)}`
