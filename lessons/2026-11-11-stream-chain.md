# The stall rescue must land on a different provider

## What

Server 1's player host stopped answering. The one automatic hop after a stall (#184) sent viewers to server 2, whose embed page is an iframe of server 1, so every rescue landed on the same dead player (PostHog: hops at 08:00 that failed again). Swapped slots 2 and 3 in the GitHub secrets and `.env.local`, then added `pnpm stream:chain`. It fetches each slot's embed page, lists the hosts it frames, and fails when the rescue slot frames an earlier slot.

## Mistakes

- #184 was verified with two fake servers on different hostnames. That proved the hop moves to another _slot_. It never checked that the other slot is another _provider_. Nobody had opened server 2's HTML: different hostnames looked like independent servers.
- The first reading of the outage blamed only the relay, because `relay:canary` was the red check. The canary was right, but the same dead host also sat behind the free embed's rescue target, and that harmed far more viewers.

## What worked

- Fetching the embed page with a browser UA and Reely's referer, then reading the iframe `src`, was enough to see the wrap. No browser was needed.
- Ran the check against the old order (red, exit 1) and the new order (green) before shipping.

## Rules

- A fallback is only a fallback if it fails independently. When adding or reordering a stream slot, run `pnpm stream:chain`.
- Wraps further down the list only warn. A viewer reaches those slots by choosing, and sees them fail.
