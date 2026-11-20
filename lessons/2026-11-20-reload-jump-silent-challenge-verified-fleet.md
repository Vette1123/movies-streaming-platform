# Refresh jump, silent challenge pass, the verified fleet

## What

- **A refresh painted the hero, then jumped down.** `BackRestore` sets `history.scrollRestoration = 'manual'`, and that value is stored on the history entry. A refresh therefore loaded with the browser's own restore off: the first frame painted at y=0, and the effect scrolled after hydration. The fix sets `'auto'` again on `pagehide`. Measured on the dev server: scroll to 1800, reload, and the first animation frame is at 1800 (it was 0).
- **The Managed Challenge on `/api/*` broke search for people who went Back too soon.** 2 of 7 hops were abandoned within 5–10s, and the 2-minute cooldown then left search, filters and seasons dead. `lib/challenge-hop.ts` now solves in an off-screen same-origin iframe (`/api/verify?next=/robots.txt`), replays the request, and hops visibly only if that fails within 10s.
- **Rails:** a static rail swiped before the List swap rendered dark boxes past card 6. It now renders every poster once scrolled. The 2xl wide set is 20 (5120px shows 18–19), and the skeleton has that many cells. Hero neighbours mount on mouse-enter and focus, so the first arrow press is never a dark slide.
- **Invocations: 60k/day, while browsers made ~3.5k API calls.** A fleet on Azure and AWS (~800 requests per IP per day, UA `Chrome/131.0 Safari/537.36`, no search-engine PTR) carried `cf.client.bot`. ALLOW_RULE skipped the whole ruleset for it, so the 2026-11-19 cloud-ASN block never ran. Now, on a cloud ASN, a verified bot only skips or escapes the block if its UA names a bot.

## Mistakes

- The 2026-11-19 cloud block was declared done because the rule existed, not because the fleet's requests had stopped. Firewall events for one fleet IP showed 1,064 `skip`, 0 `block`.
- I first suspected the Brave localStorage crash was still live. `lib/safe-storage.ts` had already fixed it on 11-15, a few hours after the only event.

## What worked

- `cf:cpu` by route (71% `/movies/` + `/tv-shows/` tail ids), then 200 HTML by UA, then by IP, then firewall events for one IP. That chain ended at the action (`skip`), which named the rule.
- `requestAnimationFrame(() => window.__y0 = scrollY)` in the head script measured the first painted frame of a reload, without needing to watch it.

## Rules

- A block rule is verified by the blocked traffic's own firewall events (`action`), not by the rule being present. Check one IP from the fleet the day after.
- `cf.client.bot` alone is not trust on a cloud network. Every crawler we want names itself.
- `history.scrollRestoration = 'manual'` must go back to `'auto'` on `pagehide`, or a refresh paints the top first.
