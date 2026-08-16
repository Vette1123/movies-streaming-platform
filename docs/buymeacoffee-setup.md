# Buy Me a Coffee: what to fill in, field by field

Everything the dashboard asks for, in the order it asks. The reasoning behind the
scheme — why one account can serve several projects and why the offer _name_ is
the only thing tying support to one of them — is written once in the sibling
project and not repeated here:
`../../social-media-downloader/docs/buymeacoffee-setup.md`.

What matters here: this project's tag is `Reely` (`SUPPORT_TAG` in
`config/support.ts`), and its endpoint recognises those two names and nothing
else. A purchase of another project's offer arrives at this endpoint, matches
nothing, grants nothing.

## The two offers

Both live on the memberships shelf. The second is a **one-time** level — a
membership billed once rather than on a cycle — which is why it fires the same
`membership.started` event and needs no special handling.

**The lifetime is account-wide, and not by choice.** Buy Me a Coffee allows
exactly one lifetime level per account, not one per project, so a tagged
`Reely — Lifetime` cannot exist next to `Downloader — Lifetime` — the dashboard
refuses the second one. The options were no lifetime here, or one lifetime that
covers everything, and the second is what shipped: a single untagged level whose
name every project's config repeats verbatim. $99 buys supporter status in all of
them at once.

This is the one deliberate exception to the tag rule. It is safe in the direction
that matters — the _recurring_ $5 level is still tagged, so the cheap offer
cannot leak across projects — and the copy on every support page now says the
lifetime covers everything rather than one site. The cost is that the price is
set once for the whole shelf and the level name has to be changed in every
project's config in the same sitting, or it silently stops granting everywhere at
once.

| Field           | Value                                          | Where it lives in code                |
| --------------- | ---------------------------------------------- | ------------------------------------- |
| Tag             | `Reely`                                        | `SUPPORT_TAG`, `config/support.ts`    |
| Recurring level | `Reely — Supporter`                            | `SUPPORT_MEMBERSHIP` (derived)        |
| One-time level  | `Lifetime — everything I build`                | `SUPPORT_LIFETIME` (untagged, shared) |
| Prices          | $5 monthly · $50 yearly · $99 once             | `SUPPORT_PRICES`                      |
| Membership URL  | `https://buymeacoffee.com/vetteotp/membership` | `SUPPORT_URL`                         |
| Webhook URL     | `https://www.reely.space/api/billing/bmc`      | dashboard only                        |
| Signing secret  | `BMC_WEBHOOK_SECRET`                           | `.env.local` + Worker secret          |

The separator is an em dash. The handler folds case, spacing and every kind of
dash before comparing, so `Reely - Supporter` typed with a hyphen still matches.
What it cannot survive is a different _word_ — rename an offer in the dashboard
and every grant stops, with one log line to say so.

Two things about how the card renders, learned from the live page rather than the
editor:

- **A blank line between a bullet list and a following paragraph collapses**, so
  every description below _ends_ on its bullets and puts its closing thought
  first.
- **A reward's title and its description run together** with no separator, so
  each description reads as a whole sentence following its title, never as a
  fragment completing it.

Descriptions are capped at **450 characters**, and the cap is enforced on save
rather than shown as a live counter — the editor gives no warning until it
refuses. The two below measure 406 and 413 with LF newlines, 412 and 419 if the
provider counts CRLF as two characters each. The first draft of both ran ~465 and
was rejected; the wording here is what survived the trim, so re-check the count
after any edit rather than assuming there is room.

## Level 1 — Supporter (recurring)

**Name**

```
Reely — Supporter
```

**Price** — `5` per month, `50` per year.

**Description**

```
$5 a month keeps Reely online. The site stays free for everyone either way — support is what moves your library off this one browser, and what pays the bills.

What changes for you:
• Watchlist, history and episode ticks, synced to every device
• Shareable lists, with your own notes and scores
• Alerts the day an episode airs or a saved film lands
• Your year in Reely, six accent themes, a denser layout
```

**Rewards** — six, in this order. The list is the card: someone scanning it
should be able to tell what changes for them without opening the description. One
benefit per reward, phrased as the thing they get rather than the feature name.

**Reward 1**

```
Your library on every device
```

```
Saved titles, watch history and every episode you have ticked off, kept in step across your phone, your laptop and the browser on the TV. A new device signs in and finds everything already there.
```

**Reward 2**

```
Lists worth sharing
```

```
Build collections out of your own library, put a note and a score on anything worth one, then publish a list as a real link that unfurls with poster art wherever you paste it.
```

**Reward 3**

```
Alerts when it actually airs
```

```
A notification the day a new episode of something on your watchlist is out, and the day a film you saved reaches its release date.
```

**Reward 4**

```
Your year in Reely
```

```
Hours watched, titles finished, the genres you keep coming back to, your longest streak. Built from what you already track, on a card worth screenshotting.
```

**Reward 5**

```
Six accents and a denser layout
```

```
Small, and the thing you will see every session. It follows your account, so every device you sign in on looks the same.
```

**Reward 6**

```
My personal number, and a say in what gets built
```

```
Supporters get my direct contact — message me any time, about anything. Ask for a feature and I will build it if it can be built. Supporters are a short list, so this is a real promise rather than a nice sentence.
```

**Welcome note** — the only place the number goes. A phone number in a public
reward description gets scraped within days; in here it reaches members and
nobody else. Replace the placeholder before saving.

```
Thank you — this is the part that keeps the lights on. 🎉

Nothing else to do: your supporter status switches itself on for the address you paid with, usually within minutes. If you sign in with a different address, reply here with the one you use and I'll move it across, same day.

Here is my direct line: <your WhatsApp / Telegram number>. Message me any time — something broken, something missing, or a feature you want. If it can be built, I will build it. That is the half of this I actually enjoy.
```

**Advanced settings** — free trial off, member limit off, Discord roles off.

## Level 2 — Lifetime (one-time, account-wide)

One level for the whole account, not one per project — the provider allows only
one. It already exists on the account as `Downloader — Lifetime`: **rename that
level, do not create a second one**, and update its description and rewards to
the generic copy below.

**Name**

```
Lifetime — everything I build
```

**Price** — `99`, one-time. Unchanged.

**Description** — names no single project, because it grants in all of them.

```
$99 once and that is the end of it. No renewal, no card on file, nothing to cancel — under two years of the yearly, then it never comes up again.

It is not tied to one site. It switches on supporter status in every project I build — the downloader, Reely, and whatever comes next — including the ones that do not exist yet.
```

**Rewards** — five, and none of them may name a single project's features, since
this level grants across all of them. Delete the Downloader-specific rewards
currently on it (the queue, the ZIP, the sponsor card); a stale reward under a
new description is the fastest way to look careless.

**Reward 1**

```
Every project, not just one
```

```
Supporter status switches on across everything I build — the downloader, Reely, and whatever comes next. One payment, every site, for the address you paid with.
```

**Reward 2**

```
Paid once, yours for good
```

```
No renewal, no card left on file, nothing to cancel, and no email from me next year asking you to confirm anything.
```

**Reward 3**

```
Everything I add later
```

```
New supporter features land on your account automatically, at no extra cost, for as long as these things run — including on projects that do not exist yet.
```

**Reward 4**

```
Nothing to set up
```

```
Your status switches on automatically for the address you pay with, usually within minutes. Sign in to any of my sites with that same address and it is already there.
```

**Reward 5**

```
My personal number, and a say in what gets built
```

```
Supporters get my direct contact — message me any time, about anything. Ask for a feature and I will build it if it can be built. Supporters are a short list, so this is a real promise rather than a nice sentence.
```

**Welcome note** — same rule: the number lives here, never in a public reward.

```
Thank you — that is a serious chunk of a year's running costs, in one go. 🎉

Nothing else to do, and nothing to renew: your supporter status switches itself on for the address you paid with, on every project I run, and it does not expire. If you sign in with a different address, reply here with the one you use and I'll move it across, same day.

Here is my direct line: <your WhatsApp / Telegram number>. Message me any time — something broken, something missing, or a feature you want. If it can be built, I will build it. You are on a very short list now.
```

## The webhook

**Name** — `Reely supporters`. **Endpoint URL** —
`https://www.reely.space/api/billing/bmc`.

### Events to tick

The dashboard shows friendly labels grouped by product; the payload carries a
different string, and the handler matches on the string. Both are listed so the
picker can be read against the code (`lib/billing/bmc.ts`).

| Tick | Dashboard label                      | Payload `type`                                                        | Why                                                                            |
| ---- | ------------------------------------ | --------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| ✅   | Membership started                   | `membership.started`                                                  | both offers arrive here — the Lifetime is a one-time membership                |
| ✅   | Membership updated                   | `membership.updated`                                                  | a level change arrives as an update; re-granting is idempotent                 |
| ✅   | Membership cancelled                 | `membership.cancelled`                                                | revokes, unless the row is marked lifetime                                     |
| ✅   | Membership paused                    | `membership.paused`                                                   | a paused membership is not being charged, so it revokes too                    |
| ✅   | Extras purchased                     | `extra_purchase.created`                                              | costs nothing now, and is what a Lifetime moved to the Extras shelf would send |
| ✅   | Monthly support started              | `recurring_donation.started`                                          | only fires if monthly support is enabled; the handler already knows it         |
| ✅   | Monthly support updated              | `recurring_donation.updated`                                          | as above                                                                       |
| ✅   | Monthly support cancelled            | `recurring_donation.cancelled`                                        | as above                                                                       |
| ❌   | Support created / refunded           | `donation.created` / `donation.refunded`                              | a plain coffee carries no offer name to match — see below                      |
| ❌   | Commissions, Wishlists, Shop refunds | `commission_order.*`, `wishlist_payment.*`, `extra_purchase.refunded` | this project sells none of them                                                |

Anything ticked that the code does not know logs
`bmc webhook: event type not handled <type>` and grants nothing — harmless, and
that line is the only place the provider's real spelling ever appears.

`extra_purchase.created` also fires for every other item sold from the extras
shelf. That is safe here only because the name still has to match the tag.

### Wiring steps

1. **Create the endpoint**, tick the eight events above, and copy the signing
   secret. Each endpoint on the account has its own secret; do not reuse the
   sibling project's, or every delivery fails the HMAC with `401 bad signature`.

2. **Store the secret** in two places — locally in `.env.local` as
   `BMC_WEBHOOK_SECRET`, and in GitHub → Settings → Secrets → Actions under the
   same name, which `deploy.yml` pushes as a Worker secret. Until it is set the
   route answers `503` and grants nothing; it is never optional while the route
   is registered, because an unverified webhook endpoint lets anyone grant
   themselves supporter status.

3. **Apply the migration** against the `reely` D1, and verify rather than trust
   the tracker:

   ```powershell
   pnpm exec wrangler d1 execute reely --remote --command "SELECT name FROM sqlite_master WHERE name = 'supporters'"
   pnpm exec wrangler d1 migrations apply reely --remote
   ```

4. **Send a test event from the dashboard and read what arrived.**

   ```powershell
   pnpm exec wrangler tail --format pretty
   ```

   The envelope is documented — `event_id`, `type`, `live_mode`, `created`,
   `attempt`, `data` — but the field names _inside_ `data` are only published in
   an OpenAPI file behind the dashboard login, so `pickEmail` and `pickLevel`
   search a list of candidate keys. Three log lines matter:
   `event type not handled` (wrong spelling, or an event we ignore),
   `no email in payload` (add the real key to `EMAIL_KEYS`), and
   `level not configured here` (expected for a sibling project's purchase; it
   prints the name, and `(none)` means no name was found at all).

   The dashboard's own fixture always says `Basic`, so it exercises everything
   except the path where the name actually matches. **Buy your own Lifetime
   once** rather than finding out from a supporter who paid and got nothing.

5. **Check the edge did not eat the delivery.** The sender is `BMC-HTTPS-ROBOT`
   from AWS, and a challenged request never reaches the Worker — `wrangler tail`
   shows nothing at all, which reads exactly like "nobody has bought anything
   yet". Two things on this zone already cover it: Bot Fight Mode is held **off**
   by `pnpm waf:apply` (`fight_mode: false`), and the scraper-challenge rule
   matches a fixed list of user agents plus the empty one, none of which
   `BMC-HTTPS-ROBOT` hits. If grants ever stop silently, query
   `firewallEventsAdaptive` for `/api/billing/bmc` and look for
   `action: managed_challenge`.

## One-off coffees

A plain coffee carries no offer name, so it grants nothing automatically. That is
deliberate: an untimed grant for a one-time payment of an unknown size is how
supporter status quietly becomes free. Handle it by hand if it ever happens, and
prefer an expiring window over a permanent grant.

## What happens on a real event

```
membership.started / extra_purchase.created
  → signature verified over the raw bytes (x-signature-sha256)
  → email + offer name pulled out of `data`
  → name matched against BMC_LEVELS   ← ours, or nothing happens
  → row written to `supporters`   ← the durable record, keyed by email
  → users.grants updated for every account with that address, if any exist yet
```

Support almost always arrives before the account does, because nothing on the
support page asks anyone to sign in first. That is why `supporters` exists as its
own table: the grant is recorded against the address either way, and
`claimSupporterGrants` applies it the moment that address signs in
(`lib/auth/routes.ts`).

If someone paid and does not have it, check in this order: the `supporters` row
exists (the webhook worked), a `users` row for the same address exists (they
signed in with a different one), `users.grants` contains `pro`.

```powershell
pnpm exec wrangler d1 execute reely --remote --command "SELECT s.email, s.level, s.lifetime, u.id, u.grants FROM supporters s LEFT JOIN users u ON u.email = s.email WHERE s.email = 'buyer@example.com'"
```

A `NULL` in `u.id` is the common case and the one no code can fix: they paid
under one address and signed in with another. Move it by hand.
