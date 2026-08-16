# Lessons

One file per finished unit of work: `lessons/YYYY-MM-DD-slug.md`.

Sections: **What / Mistakes / What worked / Rules.**

The **Mistakes** section is the point — git already records what was built. Write
down the wrong turn: the assumption that turned out false, the thing verified the
wrong way, the fix that nearly shipped, the code written and then thrown away. If
a unit of work genuinely had no wrong turn, say so in one line and keep it short.

Read the lessons touching an area before starting work in it. Commit the lesson
with the work, not after.

| Date       | Lesson                                                                                     | The one thing                                                                                                                                               |
| ---------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-13 | [Image CDN fallback quality](2026-08-13-image-cdn-fallback-quality.md)                     | The fallback CDN was never worse per pixel — it was asking for the wrong width, and upscaling.                                                              |
| 2026-08-14 | [Cover-aware image `sizes`](2026-08-14-cover-aware-image-sizes.md)                         | `sizes` must describe what `object-cover` paints (`100svh × ratio`), not the box — and `naturalWidth` is not the decoded width.                             |
| 2026-08-15 | [Accounts, supporters and D1](2026-08-15-accounts-supporters-d1.md)                        | A slug is identity, not visibility; a revoked entitlement is a tombstone, not a deleted row — a replay needs the state to still be there.                   |
| 2026-08-16 | [One CF token, one env file](2026-08-16-one-cf-token-one-env-file.md)                      | A token's permissions come from reading the scripts and running them — a green `GET` probe is not an audit; and `.dev.vars` silently disables `.env.local`. |
| 2026-08-16 | [D1 provisioning and seeds](2026-08-16-d1-provisioning-and-seeds.md)                       | Wrangler applies every `.sql` in `migrations/` as a migration — a seed left there ships its fixture to production exactly once, invisibly.                  |
| 2026-08-16 | [BMC dashboard limits](2026-08-16-bmc-dashboard-limits.md)                                 | One lifetime level per account, not per project — a provider's shelf limits are UI facts to check before writing copy, not after.                           |
| 2026-08-16 | [OAuth branding review](2026-08-16-oauth-branding-review.md)                               | A verification reviewer sees a screenshot — an `sr-only` h1 and perfect metadata do not explain your app's purpose at 390px wide.                           |
| 2026-08-16 | [Support discoverability](2026-08-16-support-discoverability.md)                           | A component cannot be passed as a prop from a Server Component — pass a string key and resolve it on the client.                                            |
| 2026-08-16 | [BMC webhook live probe](2026-08-16-bmc-webhook-live-probe.md)                             | The apex→www 301 covered the webhook path too — a money path is verified by firing it at production and reading the row.                                    |
| 2026-08-16 | [Email Routing support address](2026-08-16-email-routing-support-address.md)               | Two SPF records is a permerror, not a merge — and the Email Routing wizard resets `-all` to `~all` behind you.                                              |
| 2026-08-16 | [Supporter calendar feed](2026-08-16-supporter-calendar-feed.md)                           | A one-off export is a worse feature than a feed — and never answer a machine poller with an error status when an empty valid document will do.              |
| 2026-08-16 | [Backup stream servers](2026-08-16-backup-stream-servers.md)                               | Visible is not clickable — hit-test every overlay with `elementFromPoint`; the bottom of a video is the most contested space on the page.                   |
| 2026-08-16 | [Up next and the pitch](2026-08-16-up-next-and-the-pitch.md)                               | Grep before proposing a feature — two of them already shipped; the next episode is the first GAP, never the highest plus one.                               |
| 2026-08-16 | [Ratings, recs and import](2026-08-16-ratings-recs-import.md)                              | Account features are verified under `pnpm preview`, never `pnpm dev` — and seed the client, because the sync engine tombstones hand-written server rows.    |
| 2026-08-16 | [Menus, an empty tile and the pro pitch](2026-08-16-menus-empty-tile-and-the-pro-pitch.md) | A second map keyed by a shared table's ids is a bug with a delay on it — and `preventDefault` in the harness is what stopped the popover closing.           |
