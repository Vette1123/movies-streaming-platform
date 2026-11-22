# Command-menu avatar: 163 KB PNG to a 2.7 KB WebP

## What

Audit of every image Reely serves. TMDB art already goes through wsrv.nl with a
srcset and WebP output (no Cloudflare transform, so no per-image billing), the LCP
hero carries `fetchPriority="high"`, and everything below the fold is lazy. The one
oversize own-origin file was `public/personal-logo.png` (640x640, 163 KB), painted at
about 32 px in the command menu. It is now `personal-logo.webp` at 128 px (2.7 KB) with
a week of cache, and `tests/public-image-budget.test.ts` fails on any raster in
`public/` over 100 KB.

## Mistakes

Nearly started with the cache-header gap: live `/apps/*` and `/promo/*` still answered
`max-age=0`. The `_headers` rule was already committed two minutes earlier and the deploy
was mid-flight, so that was a stale edge copy, not a missing rule. Check `gh run list`
before "fixing" a header that was just changed.

## What worked

Size budget as a test over the folder, so the next 900 KB PNG is a red test and not a
review comment. Zone settings (Polish, Mirage, Image Transformations) stay off: the
free plan bills unique transforms past 5,000, and TMDB's catalogue is far past that.

## Rules

- Never route TMDB posters through `/cdn-cgi/image`: unique source x width pairs
  are unbounded. Pick the TMDB/wsrv width per slot instead.
- An image painted at N px ships at 2N px at most.
