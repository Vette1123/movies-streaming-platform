# PostHog sweep: stale route, recent-search rage clicks

## What

Error board was empty (0 open of 4). `posthog:usage` surfaced two real bugs and one ops call:

1. **Stale `route` on custom events.** `media_detail_viewed` on `/movies/414906` carried `route=/movies/year/:year`. The `route` super property is registered by the `$pageview` effect, and on a client navigation that can run after the new page's own effects. `track()` now stamps `route` from `location.pathname` at call time (`tests/analytics-route.test.ts`).
2. **Rage clicks on the recent-search X.** One person clearing their history item by item; each removal shifts the list under the pointer. `useRecentSearches().clear` already existed with no caller; the palette now shows a "Clear recent searches" row when there are 2+ terms (`feature_used {feature: recent_searches}`).
3. **Player stalls**: every `player_failed` is a 9s stall; vidsrc.to stalls on 13% of plays vs vidsrc.sh 4%. The default server is an env var, so this is a config call, not a code fix. Left as a recommendation.

## Mistakes

- The usage report's `/tv-shows/year/:id` vs `:year` rows looked like `routeTemplate` mis-templating year pages. The template was right; the value was stale. Querying `route` against `$pathname` showed it in one query.
- The rage-click looked like a broken button until the person's event timeline showed sequential successful removals.

## What worked

- Breaking a rage-click down by `elements_chain`, then pulling that one person's timeline, turned "frustration hotspot" into a concrete missing affordance.

## Rules

- A super property registered from an effect is not the truth for events fired in the same navigation; stamp per-event context at capture time.
- Before fixing a rage-click, read the person's timeline: repeated success looks the same as repeated failure.
