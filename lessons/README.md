# Lessons

One file per finished unit of work: `lessons/YYYY-MM-DD-slug.md`.

Sections: **What / Mistakes / What worked / Rules.**

The **Mistakes** section is the point — git already records what was built. Write
down the wrong turn: the assumption that turned out false, the thing verified the
wrong way, the fix that nearly shipped, the code written and then thrown away. If
a unit of work genuinely had no wrong turn, say so in one line and keep it short.

Read the lessons touching an area before starting work in it. Commit the lesson
with the work, not after.

| Date       | Lesson                                                                 | The one thing                                                                                                                                               |
| ---------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-13 | [Image CDN fallback quality](2026-08-13-image-cdn-fallback-quality.md) | The fallback CDN was never worse per pixel — it was asking for the wrong width, and upscaling.                                                              |
| 2026-08-14 | [Cover-aware image `sizes`](2026-08-14-cover-aware-image-sizes.md)     | `sizes` must describe what `object-cover` paints (`100svh × ratio`), not the box — and `naturalWidth` is not the decoded width.                             |
| 2026-08-15 | [Accounts, supporters and D1](2026-08-15-accounts-supporters-d1.md)    | A slug is identity, not visibility; a revoked entitlement is a tombstone, not a deleted row — a replay needs the state to still be there.                   |
| 2026-08-16 | [One CF token, one env file](2026-08-16-one-cf-token-one-env-file.md)  | A token's permissions come from reading the scripts and running them — a green `GET` probe is not an audit; and `.dev.vars` silently disables `.env.local`. |
| 2026-08-16 | [D1 provisioning and seeds](2026-08-16-d1-provisioning-and-seeds.md)   | Wrangler applies every `.sql` in `migrations/` as a migration — a seed left there ships its fixture to production exactly once, invisibly.                  |
