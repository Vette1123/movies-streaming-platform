/**
 * The regions "now streaming" alerts can be asked about.
 *
 * TMDB's watch-provider payload carries every country it knows, which is a
 * couple of hundred — storing all of them per title would put a kilobyte of
 * JSON on every row in `watched_media` to serve the handful anybody has
 * actually chosen. So the sweep keeps only these, and the alert is offered only
 * for these.
 *
 * Adding one is free at the sweep (it reads the same response either way) but
 * NOT retroactive: rows already stored carry the old set until their next
 * check, so a newly added region goes quiet for up to a full sweep cycle rather
 * than announcing everything at once. That is the safe direction.
 */
export const ALERT_REGIONS = [
  { id: 'US', label: 'United States' },
  { id: 'GB', label: 'United Kingdom' },
  { id: 'CA', label: 'Canada' },
  { id: 'AU', label: 'Australia' },
  { id: 'DE', label: 'Germany' },
  { id: 'FR', label: 'France' },
  { id: 'ES', label: 'Spain' },
  { id: 'IT', label: 'Italy' },
  { id: 'BR', label: 'Brazil' },
  { id: 'IN', label: 'India' },
  { id: 'EG', label: 'Egypt' },
  { id: 'AE', label: 'United Arab Emirates' },
  { id: 'SA', label: 'Saudi Arabia' },
  { id: 'NL', label: 'Netherlands' },
  { id: 'SE', label: 'Sweden' },
  { id: 'JP', label: 'Japan' },
] as const

export const ALERT_REGION_IDS: string[] = ALERT_REGIONS.map((r) => r.id)

/**
 * What a region means when nobody has said.
 *
 * A static export has no request-time geo, and guessing from the browser's
 * locale gets a lot of people wrong (an `en-US` locale is the default on half
 * the phones in the world). So the pref simply starts unset, alerts stay quiet,
 * and the panel asks — this constant is only what the picker shows first.
 */
export const DEFAULT_ALERT_REGION = 'US'

export const regionLabel = (id: string | undefined | null): string =>
  ALERT_REGIONS.find((r) => r.id === id)?.label ?? 'your region'
