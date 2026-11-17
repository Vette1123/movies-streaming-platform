# A bot fleet on 404s, og:url on /start, and "404 /" in cf:health

## What

- A fleet that started 2026-11-17 04:00 UTC sent about 285 "people" to PostHog. Each loaded one random `/movies/<id>` that 404s and then left. Its profile: desktop Chrome, mostly Linux, `$direct`, 1920×1080, rotating timezones, dwell p50 1s, never clicks. `{humans}` passed it: it is a real browser with a real UA. PostHog now waits for a click or key press when the visit **landed** on an HTTP error page (`landedOnErrorPage` in `lib/posthog-client.ts`, wired in `scheduleInit`). Scrolling does not count. The queued `page_not_found` still replays for a person who does click.
- `/start` set a canonical and no `openGraph`, so it inherited the root layout's `og:url`, the homepage. `withSiteSocial` now builds an openGraph from the page's own title, description and canonical, and `og:url` defaults to the canonical everywhere.
- `/match-night`, `/support`, `/press` and `/advertise` had titles under 25 characters; they now run 35–50 and carry the search terms.
- `cf:health` showed 294 + 105 "404 /" rows that looked like the homepage 404ing. They were the roots of `relay(-b).reely.space` and `play.reely.space`. The 4xx query now carries the host, and a root/favicon/robots 404 on those hosts is filed as by design.

## Mistakes

- I read the PostHog reach drop as a possible regression before breaking it down by landing status. Every one of the ~285 new persons had landed on a 404. Break a reach change down by first-page status before suspecting the product.
- My first `cf:health` rule filed **every** 4xx on the player/relay hosts as benign, which would also have hidden a real player failure. I narrowed it to `/`, `/favicon.ico` and `/robots.txt`.
- I flagged vidlink.pro at "13 failures vs 10 plays" as broken. `media_played` carries no source, so that ratio compared two unrelated counts. The real split: 12 stalls from just 3 people, while the default vidsrc.sh stalled for 20 people. Nothing was reordered.
- The fleet's history stays in today's 30-day window. No event-level filter can express "landed on a 404 and never interacted", so the history was left alone.

## What worked

- Checking `performance.getEntriesByType('navigation')[0].responseStatus`, which tells you the landing page's HTTP status with no network cost and is set before React runs.
- Checking titles and `og:url` with curl against the dev server instead of a production build.

## Rules

- A visit that landed on an error page and never clicked is not a person. Gate the analytics init on it, never the event.
- `withSiteSocial` owns `og:url`. A page with a canonical never needs its own openGraph just to get the URL right.
- A 4xx row in `cf:health` without its host is ambiguous: always query `clientRequestHTTPHost` too.
