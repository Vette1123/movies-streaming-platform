import type { Metadata } from 'next'

/**
 * Metadata for the four fallback shells (app/*-fallback/layout.tsx).
 *
 * Each shell is served under a real URL — /movies/<id>, /collection/<id>,
 * /l/<slug>, /u/<handle> — and hydration re-renders the head from the shell's
 * OWN metadata. Inherited from the root layout, that included
 * `canonical: https://www.reely.space` and an en-US/x-default alternate
 * pointing at the homepage: every tail page told Google it was a copy of `/`.
 * ~15,000 of them were filed as "Alternative page with proper canonical tag".
 *
 * `alternates: null` drops the inherited set, so hydration has no canonical to
 * put back and the one the Worker wrote survives. useServedMetadata still
 * writes it from the URL, for a head React rebuilt anyway.
 */
export const shellMetadata: Metadata = { alternates: null }
