# Managed Challenge on every Worker page and public API

## What

Follow-up to [the cloud-ASN fleet](2026-11-19-cloud-asn-fleet.md). The ASN block only stops networks already on the list, so the old "challenge non-browser clients on detail pages" rule now challenges every client on the Worker-billed pages (`/movies/<id>`, `/tv-shows/<id>`, `/collection/`, `/l/`, `/u/`, `/lists`) and on the public data APIs (`scripts/lib/challenge.mjs`).

Exempt:

- verified bots (SEO and AI crawlers)
- the allowlist rule's crawlers
- static assets
- genre/year hubs
- the CI smoke page
- player/relay hosts
- the Kodi add-on by UA
- machine APIs (`stream`, `pro`, `device`, `library`, `calendar`, `og`, `auth`, `sync`)

Challenge Passage is 1 day. A visitor whose first API call comes back challenged (`cf-mitigated: challenge`) makes one top-level hop through `/api/verify`, which is challenged and then 302s back (`lib/challenge-hop.ts`, installed by wrapping `window.fetch` once).

## Mistakes

- The first instinct was to challenge only documents. A visitor landing on the static homepage and searching would have hit a challenged fetch that no fetch can solve, and search would have silently broken. Every challenged API needs a way for a browser to pass it.
- Installing the fetch hook in a `useEffect` would have lost to the page's own first query, because child effects run before parent effects. It is installed at module evaluation instead.

## What worked

- Reusing the same rule slot. The free plan's 5 custom rules were all spent, and broadening the existing challenge rule cost none.
- The order is taken care of by CI: deploy (the hop code) runs before `waf:apply` (the challenge).

## Rules

- A new public `/api/*` route that anybody can call goes in `CHALLENGE_API_PREFIXES`. A route a machine calls (player, Kodi, a fetcher) goes in the exempt comment, never in the list.
- Any client that cannot run JavaScript and must reach a challenged path needs an explicit exemption, like `KODI_UA`.
