# Rafiq joins the footer promo

**Date:** 2026-10-31
**Area:** `components/app-promo.tsx`, `lib/promo.ts`, footer

## What

The Masareef strip became one data-driven `AppPromo`. `lib/promo.ts` holds each app's
copy and icon, and `pickPromo(pathname)` chooses one per route with a djb2 hash. Server
and client read the same path, so there is no hydration mismatch, and each page keeps its
app. Analytics `action` carries the app slug.

## Mistakes

The first draft of the Rafiq body used a curly apostrophe; the owner's copy uses a
straight one, and the test now pins the exact string.

A stray empty heredoc to `python` hung the shell for two minutes. Skip it.

## What worked

- Reusing the strip's markup unchanged, so no layout re-test was needed.
- Pinning "both apps appear" against a fixed route list rather than a random draw.

## Rules

- One footer slot, many apps: pick from a stable value (the route), never `Math.random`.
- Icon size lives in the data and the test reads it, so a new app needs no test edit.
