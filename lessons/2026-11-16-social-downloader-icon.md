# Drawer: Social Downloader shows its real mark

## What
The mobile drawer's "Social Downloader" row used lucide's generic `Download` glyph. It now renders the site's new app mark (chat bubble + download arrow) through the same `makeIcon` path the companion apps use: `SOCIAL_DOWNLOADER_ICON` in `components/companion-app-icon.tsx`, file `public/apps/socialdownloader.webp` (120px, rendered from social-media-downloader's `src/lib/brandMark.ts`).

## Mistakes
- The first test went in `components/`; vitest only includes `tests/**/*.test.ts`, so the "red" run collected nothing and looked like a pass. Moved to `tests/` and saw it red, then green.

## What worked
- Reusing `makeIcon` instead of a new component: same size, squircle and ring as the app rows.

## Rules
- Tests live in `tests/`; a run that prints no "Tests" line did not run your test.
- When Social Downloader's mark changes, re-render this file from its `brandMark.ts`.
