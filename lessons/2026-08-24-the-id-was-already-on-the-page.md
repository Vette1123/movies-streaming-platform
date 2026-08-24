# The id was already on the page

**Date:** 2026-08-24
**Area:** player subtitles (`components/*/details-hero.tsx`, `lib/pro/ticket-cache.ts`, `cloudflare/worker.js`)

## What

The player's best subtitle source is addressable by IMDb id and nothing else.
Reely now puts one in the play URL (`im=tt…`), threaded from the detail page
through the ticket, and the account's subtitle setting lists the fifty
languages the player can actually fetch instead of eleven.

## Mistakes

- **Nearly added a TMDB call to the critical path.** The first plan was for the
  ticket endpoint to look up `external_ids` at mint time — one more upstream
  request on the exact round trip that had just been optimised away by warming
  the ticket on intent. The id was already in the page's own data: detail pages
  append `external_ids` to the single TMDB request that renders them, and the
  movie type carries `imdb_id` at the top level. Reading what the page already
  holds cost one line per hero.
- **The type said no when the runtime said yes.** `external_ids` was declared
  only on `SeriesDetailsWithExtras`, while the peel in `services/series.ts`
  keeps the field on the object handed to the page as `SeriesDetails`. The fix
  is moving the declaration to where the value actually lives, not casting at
  the call site.

## What worked

- Fifty chips in the account panel scroll in place (`max-h-48 overflow-y-auto`
  once a list passes sixteen options) rather than pushing every setting below
  them off the screen — one condition inside the shared `PrefChips`, not a
  second component.

## Rules

1. Before fetching an identifier, check whether the page that is asking already
   received it. Detail pages here carry more than they render.
2. A field the runtime provides belongs on the type the consumer sees.
