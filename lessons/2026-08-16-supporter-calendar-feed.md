# Supporter calendar feed, and a support address that exists

**Date:** 2026-08-16

## What

Two things shipped together, both aimed at the same question — why would anyone pay for this.

1. **Coming up** — a new account section (`/account#upcoming`) listing every dated episode and release day across the signed-in supporter's watchlist, plus:
   - `GET /api/upcoming` — the panel's data, and the account's feed URL.
   - `POST /api/upcoming` — the same, with the feed token rotated.
   - `GET /api/calendar/<token>.ics` — a **subscribable** feed that Google Calendar, Apple Calendar and Outlook poll on their own. `webcal://` link, one-off `.ics` download, and a "replace link" button next to it.
   - `lib/upcoming/ics.ts` — RFC 5545 output, pure and tested (`tests/upcoming.test.ts`).
   - Migration `0002_calendar_feed.sql` — `users.calendar_token` + a UNIQUE index. Applied to production before the deploy.
2. **`support@reely.space`** printed everywhere money is involved: the support page (a whole contact section, plus two FAQ entries), the footer's site nav, the account console's plan panel, the supporter plan view, privacy and terms.

## Mistakes

- **The panel was almost a separate `/upcoming` route.** That would have meant a new prerendered page, a nav entry, and a second place for the account's "is this person a supporter" logic to live. The account console already owns a section rail driven by one `SECTIONS` table — adding a row to it was the whole change. Caught before writing the route, but only just.
- **The first version shipped only the `.ics` download.** It works, and it is worth almost nothing: an imported file is a snapshot, so the feature would have gone stale the day after anyone used it and never mentioned itself again. The subscribable URL is the same query behind a different door, and it is the half that gives somebody a reason to keep paying next month. Downloading is now the fallback, not the feature.
- **`foldLine`'s test asserted against `parts.join('')`** after already splitting on CRLF, so the `replace(/\r\n /g, '')` that was supposed to undo the folding matched nothing and the assertion compared the folded string to the unfolded one. The implementation was right; the test was wrong, and a test that fails for its own reasons is worse than no test because it costs a debugging session. Assert against the function's actual return value, not a re-derivation of it.
- **A refusal on the feed nearly returned 401.** Correct as HTTP, wrong as behaviour: a calendar client that gets a 401 marks the subscription broken and shows the user a warning it will never clear on its own, even after support resumes. It returns an **empty valid calendar** instead — quiet, honest, and self-healing.
- **"Replace link" confirmed with `window.confirm`.** It ships in ten seconds and looks like a browser error: chrome-styled, headed "www.reely.space says", untouched by the app's own design, and blocking the main thread while it is up. The app already had an `AlertDialog` doing the same job on the watch-history page, so this was also the second copy of one pattern. Both now go through `components/ui/confirm-dialog.tsx`. **A native dialog is never the answer in an app that already has a component for the question.**
- **`components/ui/button.tsx` set no `type`.** A bare `<button>` inside a `<form>` submits it, and a form with no action reloads the page — which reads to the person using it as the app crashing and reopening. Only one form exists in this codebase and its submit button is explicit, so nothing was broken today; the default is now `type="button"` (except under `asChild`, where the tag belongs to somebody else) so the class cannot appear later.
- **The empty schedule said the wrong thing.** "Nothing dated yet" is true both of an account waiting on the sweep and of an account with an empty watchlist, and those want opposite responses — subscribe now vs. go and save something. Found by reading production D1 rather than by reading the code: `sync_items` held four history rows and **zero** watchlist rows. `/api/upcoming` now returns the watchlist count from the same table it already joins.
- **The comment in `config/support.ts` claimed the domain could not have a support address at all**, reasoning from SPF `-all` / null DKIM / DMARC `p=reject`. Those govern _sending_; inbound was never affected, and Cloudflare Email Routing was already in place. Wrote the constraint down from memory instead of checking what the DNS actually said.

## What worked

- **Checking what the database already knew before designing the feature.** `watched_media.next_air_date` is written by the hourly sweep so alerts can fire. That makes the entire schedule a JOIN over rows that exist for another reason — zero TMDB subrequests, which is the only reason this fits the free plan at all. The expensive-looking feature was the cheapest one on the shortlist.
- **Reasoning about the WAF _before_ deploying.** The webhook's apex-redirect bug (found the hard way, days earlier) is exactly the shape of the calendar feed: a machine caller on a path that a browser-shaped rule would challenge or redirect. Both exemptions went in with the feature rather than after the first supporter reported a red calendar.
- **Headless Chrome for verification.** `--headless=new --remote-debugging-port=9333` with a scratchpad profile, driven over `BU_CDP_URL`. Same screenshots, no windows stealing focus.

## Rules

- **A one-off export is a worse feature than a feed.** If the data keeps changing, ship the URL the client polls; offer the download as the fallback.
- **Never answer a machine poller with an error status when an empty valid document will do.** Calendar clients, feed readers and webhook senders all treat a non-2xx as "broken forever" in ways the user cannot see or fix.
- **Any new `/api/*` path whose callers are machines needs both WAF exemptions** — the UA challenge and the apex→www redirect — added in the same commit as the route. `CALENDAR_PREFIX` and `WEBHOOK_PATH` in `scripts/cf-waf-setup.mjs` are the two examples; a prefix is needed when the credential is in the path.
- **Assert on what the function returned**, never on a value reconstructed from it in the test.
- **No `window.confirm` / `window.alert` / `window.prompt`, anywhere.** Use `ConfirmDialog`; add a prop to it if the case does not fit.
- **An empty state has to say _which_ empty it is.** If two situations render the same words and need different responses from the reader, fetch whatever tells them apart.
- **Check DNS before writing down what the domain can and cannot do.** SPF/DKIM/DMARC restrict sending only.
- Before adding a page, check whether an existing console section table already has a row-shaped hole for it.
