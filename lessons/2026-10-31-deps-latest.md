# Everything to latest

**Date:** 2026-10-31
**Area:** `package.json`, `pnpm-lock.yaml`, `providers/posthog-provider.tsx`

## What

Thirteen direct packages and pnpm moved to latest, all patch or minor: Next 16.4.3, Motion
14.9, posthog-js 1.444, wrangler 4.156, pnpm 12.16.1. PostHog now uses `defaults: 'latest'`
instead of a preset from 2025-05-24, and the explicit `rageclick: true` is gone, because it
was overriding the better default.

## Mistakes

A synthetic click on a movie link looked like a broken navigation after 7 seconds. It was
the first dev compile of that route. The next probe found the page had arrived.

Filtering by `dist/module.d.ts` found no `'latest'` in the types; the runtime source was the
place to read, and it confirmed the value and what each preset date changes.

The "stray" `pnpm-lock.yaml` rewrite was not random: this PC runs the standalone
`@pnpm/exe` build, which records itself in `packageManagerDependencies`. Reverting it twice
treated a symptom. It is now committed, so the file stays clean locally.

## What worked

- Reading what each `defaults` date changes before following `latest`. It showed the
  `rageclick` override, and that `split_storage` leaves `distinct_id` in the main entry.
- Checking the upstream notes for adoptable features: Next's release was backports only.

## Rules

- An explicit SDK option can hide a better default. After moving a preset, look for overrides.
- `.pnpmfile.cjs` stays until typescript-eslint's peer range admits TypeScript 7 (still
  `<6.1.0`).
- A slow route in dev is not a broken route: re-check before calling it a regression.
