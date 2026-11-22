# A check that wants a click is shown in place

## What

Since #226 (2026-11-20) public `/api/*` sits behind a Managed Challenge. Real
visitors started getting 403 `api_error`s: 11 people in 14 days, 10 countries.
Cloudflare firewall events for `/api/verify` over 23 hours:

| Path                              | IPs | Solved | Never solved |
| --------------------------------- | --- | ------ | ------------ |
| Hidden frame (`next=/robots.txt`) | 15  | 5      | 10           |
| Visible hop                       | 12  | 8      | 4            |

The hidden frame only works when the check passes without interaction. When
Cloudflare wants a click, nobody can see the checkbox. In PostHog the BR and MM
visitors' 403 lands 9–10 s after their pageview (the hidden-pass timeout), and
neither came back.

Changes:

- `lib/challenge-hop.ts`: when the hidden pass times out, the same frame is
  restyled in place as a dialog ("Quick security check"). It has a note, the
  check itself and a "Not now" button. The full-page hop happens only if the
  shown check also times out (60 s). "Not now" ends checks for that visit.
- Each outcome is a `feature_used {feature: 'security_check', action:
  hidden|shown|hop|dismissed}` event (area `health`), so the next session can
  read the solve rate from PostHog, not the firewall log.
- Browse pages stop making challenged requests they don't need:
  - Genres come from the bundled lists (`hooks/use-genres.ts`). `/api/genres`
    stays on the Worker for old tabs.
  - `useWatchProviders` takes `enabled`. The sidebar fetches only when "Where to
    watch" is open or a provider filter is set; the chips only when one is set.
    It was 7 of 31 api_errors.

## Mistakes

- The first browser check of the providers gate read `performance` resource
  entries and saw nothing after opening the section, which looked like the gate
  never opening. The request had fired: a 404 from the dev server (no Worker)
  doesn't reliably show in that list. `read_network_requests` with tracking
  started _before_ the action showed it. Use the network log for request checks.
- A stopped `pnpm dev` left its Node child holding the port (twice). Check
  `netstat` after TaskStop and kill the orphan.
- Assumed `watchlist_added` had broken because it barely appears. It has always
  been rare: about one per 2–3 weeks.

## What worked

- Testing the Cloudflare path against a 30-line local harness: a server that
  403s `/api/*` with `cf-mitigated: challenge` until a fake checkbox page
  redirects to `/robots.txt`. That drove the real module in Chrome end to end:
  shown at 10 s, ticked, outcome `shown ok`, and the original search answered 200.
- The fake-DOM unit tests (`tests/challenge-silent-pass.test.ts`), red on the
  old module (4 of 5 fail) and green on the new one.

## Rules

- A challenge frame the visitor cannot see must never be the only way through.
  Show it before giving up on it.
- A request a page makes before anyone touches it is a challenged first request.
  Bundle static data, and gate the rest on the control that needs it.
- Still open, outside this change: vidsrc.sh fails 24% and vidlink.pro 84% of
  boots (provider order lives in env and GitHub secrets; screen with `pnpm
  embed:probe`), and rage clicks on `/`.
