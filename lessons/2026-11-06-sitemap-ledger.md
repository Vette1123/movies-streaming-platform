# Sitemap ledger: an advertised title URL is never dropped

## What

Bing flagged /tv-shows/321231, /movies/1229031 and /tv-shows/330613 as "important pages missing in sitemaps". All three
return 200. The sitemap is rebuilt from TMDB lists that move (trending, popular, the rails of popular titles), so every
deploy dropped hundreds of URLs it had listed six hours earlier (14,890 ↔ 15,557 between consecutive deploys). Now
`data/sitemap-ledger.json` holds every title id the live sitemap has listed; `app/sitemap.ts` keeps listing them (minus
takedowns). `pnpm sitemap:ledger` folds the live sitemap in before every deploy build and in the daily Ratings job,
which commits it.

## Mistakes

- The 2026-08-29 fix (`buildLinkedMediaIds`) treated the same Bing report as "linked but never listed" and added the
  rail ring. It never asked whether the set was STABLE, and a rail ring of a moving list moves too.
- Assumed the flagged ids were linked from some hub; checked ten hubs before reading the deploy logs, where the
  IndexNow totals showed the churn in one line.
- `prettier --write` on the ledger expanded it to 13k lines; the script writes it compact, so every run would have
  rewritten the whole file. It is in `.prettierignore` now.

## What worked

- Reusing the `data/people.json` rule (union, never replace) and the Ratings job's commit step instead of a new workflow.

## Rules

- Any URL set a crawler is told about is a ledger, not a snapshot. Never derive a sitemap from a list that moves.
