/**
 * `--until` for `pnpm pro`: when a time-limited grant stops, as epoch ms.
 *
 * Accepts `YYYY-MM-DD` (Pro ends at 00:00 UTC that day) or `1y` (a year from
 * today). Throws on anything else, including a date that does not exist or is
 * not in the future: a typo here either gives Pro away forever or takes it
 * away today, and neither shows up until a supporter writes in.
 */
export function parseUntil(value, now = Date.now()) {
  let at
  if (value === '1y') {
    const today = new Date(now)
    at = Date.UTC(
      today.getUTCFullYear() + 1,
      today.getUTCMonth(),
      today.getUTCDate()
    )
  } else {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '')
    if (!match) {
      throw new Error(`--until wants YYYY-MM-DD or 1y, got "${value ?? ''}"`)
    }
    const [y, m, d] = match.slice(1).map(Number)
    at = Date.UTC(y, m - 1, d)
    // Date.UTC rolls 2027-02-30 over to March 2; a real date reads back the same.
    if (new Date(at).toISOString().slice(0, 10) !== value) {
      throw new Error(
        `--until wants YYYY-MM-DD or 1y, got "${value}" (no such date)`
      )
    }
  }
  if (at <= now) {
    throw new Error(
      `--until must be in the future, got ${new Date(at).toISOString().slice(0, 10)}`
    )
  }
  return at
}

/**
 * Pull `--until <value>` or `--until=<value>` out of the argument list.
 * `raw` is null when the flag is absent and '' when it has no value, so the
 * caller can tell "not asked" from "asked badly". `rest` is everything else,
 * so the value is never mistaken for the email.
 */
export function splitUntil(args) {
  const rest = []
  let raw = null
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg.startsWith('--until=')) {
      raw = arg.slice('--until='.length)
    } else if (arg === '--until') {
      raw = args[i + 1] ?? ''
      i++
    } else {
      rest.push(arg)
    }
  }
  return { raw, rest }
}
