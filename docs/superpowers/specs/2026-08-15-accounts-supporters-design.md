# Accounts, supporters, and everything an account makes possible

Date: 2026-08-15
Status: approved, in implementation

Ports the accounts + billing stack from `social-media-downloader` into Reely, and
builds the supporter-only features an account finally makes possible. Google
sign-in is optional and free; supporting the project is what unlocks the extras.
Nothing that is free today stops being free.

## Goal

Reely holds everything personal in `localStorage`: watchlist, watch history,
per-episode completion, recent searches. That has been the right call — no
account, no server, no privacy story to defend — and it has one failure the app
cannot answer: a new phone is a fresh start, and there is no way back.

An account fixes exactly that, and nothing else changes. Free users are still
anonymous with nothing stored. Signing in is available, never demanded, and never
blocks a page.

Supporting the project ($5/month, $50/year, or $99 once) turns the account into
the thing that makes Reely worth living in: your library follows you, you can
shape it into lists worth sharing, and the app can tell you when the next episode
of something you are watching actually airs.

### Non-goals

- Email/password, magic links, or any provider other than Google.
- A self-built checkout. Buy Me a Coffee hosts the payment and the receipt.
- Taking any existing feature away from anyone.
- Recording what anyone watches for any purpose other than showing it back to
  them.
- Server-side rendering of a signed-in page. Every page in this app is a static
  asset and stays one.

## The governing constraint

This is stated before the design because the design exists to obey it, not the
other way round. Reely runs on the Cloudflare free plan: 10 ms CPU per Worker
invocation, 100,000 invocations/day, 50 subrequests per invocation, 20,000
static assets. The static-export migration (2026-08-03) took Worker CPU kills
from 20–46% of invocations to 0.0% precisely by making page views not invoke the
Worker at all. Nothing here may give that back.

### Hard rules

1. **A page view invokes no Worker.** `/account`, `/support`, `/privacy`,
   `/terms`, the stats page — all prerendered static assets like every other
   page. `run_worker_first` stays `["/api/*"]`. Signed-in state is painted from a
   script-readable hint cookie plus a `localStorage` profile cache, with no
   network call on any page load.
2. **The existing `/api/*` routes gain zero work.** No new import at their call
   sites, no database read, no extra parse. Search, filter, popular, genres,
   season-details, hero-extras and the two fallback renderers must measure
   identical after this change.
3. **The tail-id fallback path gains zero work.** It is ~70% of all invocations
   and it never touches D1.
4. **Verify the webhook signature before parsing the body.** HMAC the raw bytes,
   `JSON.parse` only once it holds. Parsing first lets an unauthenticated caller
   spend our CPU on an arbitrarily large payload.
5. **No new runtime dependency.** Not one. Everything below is WebCrypto, `fetch`
   and SQL. `arctic` was measured out of the source project for adding 123 KB of
   unused OAuth providers to a bundle that is compiled on every cold isolate; we
   start from the hand-rolled flow that replaced it.
6. **Bundle size is the real CPU lever.** In a single-file Worker bundle a
   dynamically imported module is still _compiled_ at isolate startup, billed to
   whichever request created the isolate. So the defence is not `await import()`
   theatre — it is keeping the added code small (~900 lines total) and free of
   dependencies. `await import()` is still used for the reconcile and push paths,
   which is where it does buy evaluation-time savings.

### Budget per path

| Path                        | Frequency                 | CPU                                                 | Notes                                      |
| --------------------------- | ------------------------- | --------------------------------------------------- | ------------------------------------------ |
| any page view               | every visit               | 0 ms — Worker not invoked                           | unchanged                                  |
| existing `/api/*`           | as today                  | unchanged                                           | asserted by measurement, not by inspection |
| `/api/auth/refresh`         | ≤1 per 15 min of activity | cookie parse, 1 SHA-256, 1 HMAC sign                | D1 is I/O, not CPU                         |
| `/api/auth/callback`        | once per login            | 1 form POST (I/O), base64url decode, 2 writes (I/O) | ~1 ms                                      |
| `/api/billing/bmc`          | a few per day             | 1 HMAC verify, 1 parse ≤64 KB, 1–2 writes           | <1 ms                                      |
| `/api/sync`                 | debounced, on change      | 1 parse ≤256 KB, N binds                            | writes batched; I/O dominates              |
| `/api/list/*` (public read) | on share click            | 1 D1 read + shell assembly                          | cached in `caches.default`                 |
| cron sweep                  | hourly                    | ≤30 TMDB fetches, bounded                           | not on any user's request path             |

Cloudflare does not bill time spent waiting on I/O, so D1 queries, the Google
token exchange and TMDB fetches cost wall-clock latency but no CPU.

### How it gets verified

`wrangler tail`'s `cpuTime` against a local `wrangler dev` and then production,
the same method the repo already uses. Captured before merge for: an existing
`/api/search`, a tail-id fallback, `/api/auth/refresh`, and `/api/sync` with a
realistic library. A regression on the first two is a blocker regardless of what
the new paths measure.

## Product

| Offer               | Price                | Grants                   |
| ------------------- | -------------------- | ------------------------ |
| `Reely — Supporter` | $5/month or $50/year | `pro`, until they cancel |
| `Reely — Lifetime`  | $99 once             | `pro`, never revoked     |

Same prices as every other project on the Buy Me a Coffee account, because one
account serves them all and the _name_ is the only per-purchase attribute that
routes a payment to a project. The tag is `Reely`; the webhook recognises those
two names and nothing else, so a sibling project's purchase matches nothing here.

Lifetime is a multiple of the yearly, never a discount on it — at $99 it is two
years of the annual, so the annual still sells and a permanent grant is priced
like the bet it is.

### What free keeps, forever

Everything it has today: the whole catalogue, every filter, search, the
watchlist, watch history, episode tracking, the player, the PWA. All of it
local-first, all of it anonymous, no account needed. Both offer descriptions say
so out loud.

### What an account adds, free

- Your identity, so support paid under that address attaches itself.
- Somewhere to manage it: `/account`.

Sync is deliberately **not** free. It is the one thing an account is for, and it
is what supporters are paying for.

### What support unlocks

1. **Your library, everywhere.** Watchlist, watch history and per-episode
   completion sync across every device you sign in on. First sign-in merges what
   is already on the device up rather than overwriting it, so signing in never
   costs anyone the library they had.
2. **Lists.** Named collections ("Weekend", "With Dad", "Best of 2026") with an
   optional note and a personal 1–10 rating per title, and no cap on any of it.
3. **Shareable lists.** Any list can be published at `reely.space/l/<slug>` — a
   real page the Worker renders from D1 with poster art, OG tags and JSON-LD, so
   it unfurls properly in WhatsApp, Discord and iMessage. Unpublishing is one
   click and the page 404s immediately.
4. **Resume, properly.** Playback position per episode stored server-side, so
   "continue watching" continues on the device you pick up next. Auto-advance to
   the next episode, and your preferred streaming source remembered.
5. **Alerts.** A web push when the next episode of a series on your watchlist
   airs, or when a movie you saved gets a release date. Off by default, one
   toggle, revocable.
6. **Your year in Reely.** Hours watched, titles finished, top genres, longest
   streak, first and last watch — computed from data already synced, with a
   share card.
7. **The supporter look.** Six accent palettes, a supporter badge, and a
   layout-density toggle. CSS variables, synced with preferences.
8. **A direct line.** Contact in the welcome note, features built on request,
   new things first.

Points 6–8 cost nothing to serve; 1–5 are what the account exists for.

## Architecture

Three credentials with three lifetimes, and one property that matters more than
the rest: **no page view and no existing API route ever touches the database.**

```
Google  ──1──▶ /api/auth/callback ──▶ D1: upsert user, claim supporter grants,
                      │                    insert session
                      │                └─▶ Set-Cookie: reely_session (httpOnly, 90d)
                      │                └─▶ Set-Cookie: reely_account=1 (readable hint)
                      ▼
              302 back to where they were

client ──2──▶ /api/auth/refresh  (cookie) ──▶ D1: session live? entitled?
                      │
                      ▼
              { token, exp, pro, profile, prefs }  — 15 min, memory only

client ──3──▶ /api/sync, /api/lists, /api/push   Authorization: Bearer <token>
                                                  or the session cookie
```

**Session cookie** — `httpOnly; Secure; SameSite=Lax; Path=/`, 90 days, five
concurrent sessions per account (a sixth login evicts the oldest). Only the
SHA-256 of its value is stored, so a leaked database read hands nobody a working
session. Logout is a hard `DELETE`.

**Access token** — 15 minutes, HMAC-SHA256 over a tiny JSON payload
(`{u, exp, p}`), held in a JavaScript variable and never persisted. It exists so
that a request can prove entitlement without a D1 read. Reely's write paths are
not hot enough to need it for authorization — they use the session cookie — but
the client keeps it because the entitlement bit is what the UI paints from.

**Google's tokens** — discarded the moment the callback finishes. No
`access_type=offline`, no stored refresh token. Google answers "who is this"
exactly once; everything after is our session, which is what makes revocation
real.

**Hint cookie** — `reely_account=1`, readable by JavaScript, carrying no user
data. It is why the header can paint the right control on the first frame with
zero requests. It is a hint, never a credential: every real decision requires the
`httpOnly` cookie, server-side. Forging it buys an avatar that leads to a page
telling you to sign in.

### Why no Better Auth, no NextAuth, no arctic

Better Auth and NextAuth both bring a schema, a session model that reads the
database per request, and a substantial dependency into a Worker whose bundle is
compiled on every cold isolate. `arctic` was tried in the source project and
removed after measurement: 123 KB of OAuth clients for providers we do not use,
4.1 ms → 2.4 ms of isolate compile time to delete it, and it is deprecated
upstream. What is left is the flow itself — an authorization URL, a form POST, a
base64url decode — which is 190 lines and has been running in production on the
sibling project.

The security-critical parts (PKCE, state, constant-time HMAC, hashed sessions)
are ported verbatim from code that already carries its own unit tests, not
rewritten.

### Webhooks are an optimisation, not the truth

Buy Me a Coffee retries a non-2xx, but a delivery can still be lost for good — a
deploy window, an endpoint challenged by the WAF, an hour of misconfiguration. So
the grant is written to a **`supporters` table keyed by the payer's email**,
which is the durable record, and `users.grants` is refreshed from it at two
moments: when the webhook lands (if an account with that address exists) and on
**every sign-in** (`claimSupporterGrants`). Support almost always arrives before
the account does — nothing on the support page asks anyone to sign in first — and
that ordering is the whole reason the table exists.

The one case no code can fix: paid under one address, signed in with another. The
welcome note asks for the sign-in address, and moving it is one `UPDATE`.

Deliberately **not** a cron reconcile against a BMC API. BMC has no subscription
lookup worth polling, the grant is already durable in `supporters`, and a
scheduled sweep would spend its work confirming rows that were already correct.

### Entitlement

One pure function, `isEntitled(row, now)`. Nothing else decides who is a
supporter.

| Source                                       | Supporter? | Until                           |
| -------------------------------------------- | ---------- | ------------------------------- |
| `grants` contains `pro`                      | yes        | until a cancellation removes it |
| `sub_status` `active` / `trialing`           | yes        | —                               |
| `sub_status` `canceled` / `scheduled_cancel` | yes        | `sub_ends_at`                   |
| `sub_status` `past_due`                      | yes        | `sub_past_due_since + 14 days`  |
| anything else, or nothing                    | no         | —                               |

The subscription arm has no live writer today (BMC grants are a set, not a
subscription) and is ported anyway: it is what a one-off coffee is converted into
by hand (`canceled` + a future `sub_ends_at` reads exactly as "paid through this
date"), and it is the half that must already work if a card processor is ever
added. `isEntitled` is unit-tested across every status and both sides of every
date boundary.

`grants` is a comma-separated **set**, written with `withGrant` / `withoutGrant`
rather than assigned, so one grant can never silently detach another.

## Data model

`migrations/*.sql`, applied to a **new** D1 database (`reely`) on Reely's own
Cloudflare account. Five tables; three of them are the port, two are new.

```sql
-- Ported, near-verbatim.
CREATE TABLE users (
  id                 TEXT PRIMARY KEY,        -- crypto.randomUUID()
  google_sub         TEXT NOT NULL UNIQUE,
  email              TEXT NOT NULL,
  name               TEXT,
  picture            TEXT,
  created_at         INTEGER NOT NULL,
  prefs              TEXT,                    -- JSON: accent, density, autoNext, source…
  grants             TEXT,                    -- comma-separated set; `pro` is the only one here
  sub_status         TEXT,
  sub_variant        TEXT,
  sub_ends_at        INTEGER,
  sub_past_due_since INTEGER,
  sub_updated_at     INTEGER
);
CREATE INDEX idx_users_email ON users(email);

CREATE TABLE sessions (
  id         TEXT PRIMARY KEY,   -- SHA-256 of the cookie value, never the value
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

CREATE TABLE supporters (           -- migration 0008 from the source, verbatim
  email      TEXT PRIMARY KEY,
  grants     TEXT NOT NULL,
  level      TEXT,
  lifetime   INTEGER NOT NULL DEFAULT 0,
  source     TEXT NOT NULL DEFAULT 'bmc',
  event_id   INTEGER,
  updated_at INTEGER NOT NULL
);

-- New: the synced library. One row per item per store, so two devices editing
-- different titles never overwrite each other.
CREATE TABLE sync_items (
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  store       TEXT NOT NULL,      -- watchlist | history | completed | resume
  item_key    TEXT NOT NULL,      -- '550' or '1399:2:5' for an episode
  payload     TEXT,               -- the item's JSON; NULL is a tombstone
  updated_at  INTEGER NOT NULL,   -- client clock, last-write-wins per item
  PRIMARY KEY (user_id, store, item_key)
);
-- The pull is always "everything for this user changed since <cursor>".
CREATE INDEX idx_sync_cursor ON sync_items(user_id, updated_at);

-- New: lists, and the notes/ratings that hang off titles.
CREATE TABLE lists (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  slug        TEXT UNIQUE,        -- non-null only while published
  items       TEXT NOT NULL,      -- JSON array of {id,type,title,poster_path,note,rating}
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX idx_lists_user ON lists(user_id, updated_at);

-- New: push endpoints, and what the sweep has already told each of them.
CREATE TABLE push_subs (
  id         TEXT PRIMARY KEY,    -- SHA-256 of the endpoint URL
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  failed_at  INTEGER              -- set on a 404/410; two strikes and the row goes
);
CREATE INDEX idx_push_user ON push_subs(user_id);

-- New: what the cron sweep knows about a series, so it re-checks rather than
-- re-discovers. One row per series anyone is watching.
CREATE TABLE watched_series (
  series_id     INTEGER PRIMARY KEY,
  next_air_date TEXT,             -- ISO date of next_episode_to_air, or NULL
  next_label    TEXT,             -- 'S03E04 · The Bear'
  checked_at    INTEGER NOT NULL,
  notified_key  TEXT              -- the last episode we pushed about, so it goes once
);
CREATE INDEX idx_series_checked ON watched_series(checked_at);

-- Queued notifications, drained by the service worker on a payloadless push.
CREATE TABLE notifications (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  url        TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  read_at    INTEGER
);
CREATE INDEX idx_notifications_user ON notifications(user_id, created_at);
```

That is the entire set of stored data: identity, entitlement, the library you
asked us to keep, your lists, and where to ping you. No IP addresses, no
passwords, no analytics of what anyone watched.

**Indexes are load-bearing, not hygiene.** D1 bills rows _scanned_. Every column
used in a `WHERE` is a primary key or has an index above.

### Rejected from the schema

- **A `subscriptions` table.** One subscription per user, so a join bought
  nothing; the columns are denormalised onto `users` exactly as in the source.
- **Per-episode rows for resume position.** Folded into `sync_items` under the
  `resume` store — it is the same shape and the same merge rule.
- **A device list UI.** `/account` gets "Sign out" and "Sign out everywhere".
- **Storing search history server-side.** It is local, it stays local; nothing
  about it benefits from an account.

## Sync

The hard part of any sync is not the transport, it is what happens when two
devices disagree. The rule here is **last write wins, per item**, with tombstones
for deletes, which is the correct model for this data: every item is independent,
edits are rare, and the failure mode of a wrong merge is a title reappearing in a
watchlist rather than lost work.

One endpoint, `POST /api/sync`:

```jsonc
// request
{ "since": 1755200000000, "changes": [ { "store": "watchlist", "key": "550",
    "payload": {…}, "updated_at": 1755201234567 } ] }
// response
{ "now": 1755201240000, "changes": [ …the same shape, for everything the server
    has newer than `since` and did not just receive… ] }
```

- **Push and pull in one round trip.** A separate pull would double the request
  count against the 100k/day cap for no benefit.
- **`updated_at` is the client's clock**, and clock skew is bounded by clamping
  any future stamp to server-now on write. A device three hours fast would
  otherwise pin its version as permanently newest.
- **Writes are batched** through `db.batch()`, one round trip regardless of how
  many items changed.
- **The body is bounded at 256 KB** and the change count at 500 per request; a
  first-sync of a large library pages through in a handful of requests rather
  than one enormous one.
- **Debounced on the client** at 2 s after the last change, plus on
  `visibilitychange` and before unload via `sendBeacon`. Idle tabs cost nothing:
  there is no polling and no timer.
- **First sign-in merges upward.** Local items the server has never seen are
  pushed with their existing `added_at`; the server's items are adopted locally.
  Nothing is deleted on either side during the first merge, because a tombstone
  the local device never saw is indistinguishable from an item it has not
  uploaded yet.

Free signed-in users get a 402 from this endpoint and the UI never calls it.

## Push alerts

The expensive parts of web push are payload encryption (ECDH + HKDF + AES128GCM)
and the sweep that decides what to send. Both are avoided rather than optimised.

**No payload.** A push is sent with an empty body and a VAPID `Authorization`
header, which is a signed ES256 JWT — 40 lines of WebCrypto, no encryption at
all. The service worker's `push` handler then fetches `/api/push/pending` with
its own cookies and shows whatever is queued. This is a standard pattern, it
removes ~150 lines of crypto, and it has a real side benefit: the notification
text is generated at display time, so a queued alert that is no longer true is
never shown.

**The sweep is bounded and demand-driven.** An hourly cron takes the 30 series
with the oldest `checked_at` **that at least one supporter has on a watchlist**,
fetches each one's `next_episode_to_air`, and writes the result to
`watched_series`. When an episode's air date has passed and `notified_key` does
not already name it, one row per interested user is queued in `notifications` and
one push is sent per subscription. 30 TMDB fetches is well inside the
50-subrequest cap, and the cron path is not on anyone's request budget.

A subscription that answers 404 or 410 is marked `failed_at`; the second failure
deletes the row.

## Endpoints

All of them are new paths under `/api/`, dispatched by the existing Worker before
its current route table. Every one that mutates requires the session cookie;
`/api/list/<slug>` is the only public one.

| Route                 | Method   | Does                                                                               |
| --------------------- | -------- | ---------------------------------------------------------------------------------- |
| `/api/auth/google`    | GET      | State + PKCE into one-shot cookies, 302 to Google                                  |
| `/api/auth/callback`  | GET      | Validate state, exchange code, upsert user, claim grants, create session, 302 back |
| `/api/auth/refresh`   | POST     | Cookie → session → entitlement → 15-minute token + profile + prefs                 |
| `/api/auth/logout`    | POST     | Delete this session, or all with `?all=1`                                          |
| `/api/account`        | POST     | Save prefs, or delete the account (cascades)                                       |
| `/api/billing/bmc`    | POST     | Verify `x-signature-sha256`, apply the grant                                       |
| `/api/sync`           | POST     | Push + pull the library. Supporters only                                           |
| `/api/lists`          | GET/POST | Read, create, update, delete, publish, unpublish. Supporters only                  |
| `/api/list/<slug>`    | GET      | A published list, public, cached                                                   |
| `/api/push/subscribe` | POST     | Store or remove an endpoint. Supporters only                                       |
| `/api/push/pending`   | GET      | Drain queued notifications for the service worker                                  |
| `/l/<slug>`           | GET      | The shareable page: shell + real OG tags, same machinery as a tail id              |

`/api/auth/callback` is answered by the Worker and 302s on completion, so no
callback page is exported. The ID token is decoded without verifying its
signature, which is correct **only** here: it arrived over TLS as the direct
response to a server-side request authenticated with our client secret.

The Worker's current `405` for any non-GET/HEAD is moved below the new router,
since every mutating route here is a POST.

## Pages

Five new routes, all prerendered static assets.

- **`/account`** — the management page. Plan, library and sync status, lists,
  alerts, appearance, and the account itself (email, sign out, sign out
  everywhere, delete). Signed-out it renders the sign-in card, not a redirect.
- **`/support`** — what support is, what it unlocks, the three prices, and the
  two Buy Me a Coffee links. It is also the honest page: everything free stays
  free, said plainly.
- **`/stats`** — your year in Reely. Supporters only; free users see what it
  would look like with their local data and a line explaining how to keep it.
- **`/l/[slug]`** — the exported shell the Worker decorates for a published list.
  `noindex` on the bare shell URL, `index, follow` on the real thing, exactly as
  the media fallback already works.
- **`/privacy`** and **`/terms`** — required now that we are a data controller.
  Both must state the split plainly: free users are anonymous with nothing
  stored; signed-in users have an email, a Google account id and a device list;
  supporters additionally have whatever library they chose to sync. No IP
  addresses, no watch data sold or shared, deletion is one button and cascades.

The header gains one control on the right: "Sign in", or the visitor's avatar
opening a menu. It renders from the hint cookie and the cached profile
synchronously, into a fixed-size slot so there is no flash and no layout shift —
the mobile Lighthouse score is not allowed to move.

## Failure handling

- **Refresh fails on a network error** → keep the existing token and state. A
  supporter is never downgraded because one request failed.
- **A webhook is lost** → `supporters` is durable and `claimSupporterGrants` runs
  on every sign-in, so the grant lands on the next visit.
- **A webhook is replayed or arrives out of order** → guarded on `event_id` and
  the envelope's `created`; a stale cancel cannot undo a newer start.
- **Bot Fight Mode challenges the BMC sender** → the request never reaches the
  Worker and nothing logs. The sender range is allowlisted in IP Access Rules on
  this zone as part of this work, and the firewall-events query that diagnoses it
  is written into the runbook.
- **State or PKCE mismatch** → 400 and start over, unless a live session already
  exists on this browser, which means this is a duplicate delivery of a callback
  that already succeeded — swallow it quietly rather than telling somebody who is
  signed in that sign-in failed.
- **Google returns no verified email** → reject. That column is what an orphaned
  purchase is matched against.
- **Sync conflict** → last write wins per item; tombstones are never resurrected
  by an older payload.
- **D1 unavailable** → auth and sync routes answer 503 and the client keeps
  working entirely from `localStorage`. The app must degrade to exactly what it
  is today, which is a fully working app.

## Configuration

| Name                                        | Where                  | Purpose                           |
| ------------------------------------------- | ---------------------- | --------------------------------- |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Worker secret          | OAuth client                      |
| `SESSION_TOKEN_SECRET`                      | Worker secret          | HMAC for access tokens            |
| `BMC_WEBHOOK_SECRET`                        | Worker secret          | `x-signature-sha256` verification |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`    | Worker secret + public | Web push                          |
| `DB`                                        | D1 binding             | The database above                |

Dashboard work, which is where the real time goes:

1. **Google Cloud** — OAuth client, consent screen, and both redirect URIs
   (`http://localhost:8788/api/auth/callback` for `wrangler dev`, and
   `https://www.reely.space/api/auth/callback`). Mismatched redirect URIs between
   dev and production are the single most likely thing to break.
2. **Buy Me a Coffee** — two offers named exactly `Reely — Supporter` and
   `Reely — Lifetime`, a webhook endpoint at
   `https://www.reely.space/api/billing/bmc` subscribed to `membership.*` and
   `extra_purchase.created`, and its signing secret.
3. **Cloudflare** — D1 database, migrations, secrets, and the IP Access Rule for
   the BMC sender. All scriptable with the API token this repo already holds.

## Testing

The repo has no test runner today. The ported logic is money- and
security-critical and arrives with its own tests, so `vitest` is added in a
node-only configuration covering pure modules exactly as the source project does:
`isEntitled` across every status and boundary, webhook signature verification
including a tampered body and a wrong secret, replay and out-of-order rejection,
the level-name matcher including hyphen-vs-em-dash, `safeRedirect` against a
hostile absolute URL, the session eviction selection, the sync merge (newer wins,
tombstone wins, future clock clamped), and the token round trip.

Everything touching D1 is verified against a real `wrangler dev` with a real
local database, and then in a browser: sign in, support, sync across two
profiles, publish a list, receive a push.
