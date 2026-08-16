# The lifetime level the account only has one of

## What

Wired Reely's supporter tier into the shared Buy Me a Coffee account, and wrote
`docs/buymeacoffee-setup.md` — every dashboard field, the two levels' copy, the
webhook events, the debug path. Alongside it, the Google Cloud project and OAuth
client for sign-in.

The design assumption behind all of it was already written down in the sibling
project: one account serves several projects, every webhook endpoint receives
every event, and the *name* of the offer is the only thing tying a purchase to a
project. Each project tags its two offers with its own short name.

The dashboard does not allow that for the second offer. Buy Me a Coffee permits
exactly **one lifetime level per account**, not one per project, so
`Reely — Lifetime` could not exist next to `Downloader — Lifetime`. The lifetime
is now untagged and account-wide — `Lifetime — everything I build`, one level,
recognised by every project's `SUPPORT_LIFETIME`, granting in all of them at
once. The recurring $5 level stays tagged, so the cheap offer still unlocks one
project. That is the single deliberate exception to the tag rule, and it is
written on the constant in both repos.

## Mistakes

- **Wrote the whole setup document against a shelf layout nobody had checked.**
  Two tagged levels per project was specified, priced, given copy, given rewards
  and committed — and then the dashboard refused the second lifetime. This is
  the *same* mistake the sibling project's own ledger records from 2026-08-15
  ("wrote the whole setup document around a shelf the product never went on"),
  read during this work, and repeated anyway. A provider's UI constraints are
  not derivable from its API, and reading a lesson is not the same as applying
  it.
- **The rename broke a sibling repo that nothing in this one imports.** The two
  projects share the offer-name scheme but no code, so renaming the level in the
  dashboard silently invalidates the other repo's `SUPPORT_LIFETIME`. It was
  caught by thinking about the deployment order, not by any tool — no typecheck,
  test or grep in this repo can see across to it. Cross-repo constants need the
  other repo's path written on them; both constants now name each other.
- **Shipped a test that hardcoded the old level name.** `resolveLevel` had one
  case asserting on the literal `'  DOWNLOADER   LIFETIME '` rather than on the
  constant, so the rename left a red test in the sibling repo. Found by running
  the suite, which was the only reason it did not get pushed broken.
- **Both descriptions were written past the 450-character cap.** ~465 each. The
  editor shows no counter and only refuses on save, so the first attempt to
  create the level was rejected outright. Character counts belong in the doc
  next to the copy — they are now there, measured both ways in case the provider
  counts CRLF.
- **Sent the OAuth consent screen for verification with a logo attached.** A
  logo is what forces brand verification; with `openid email profile` alone and
  no logo, publishing is instant. Four verification complaints came back, two of
  which were only true because the accounts branch was not deployed yet —
  `/privacy` was 404 in production while the code for it sat in three unpushed
  commits.

## What worked

- **Running both suites rather than reasoning about them.** 16 checks here, 38
  in the sibling repo; one of the 38 failed and it was exactly the hardcoded
  name. A string change looks unbreakable, which is why it was worth the 500ms.
- **Checking the live site before believing Google's complaints.** `curl` on
  `/privacy` returned 404 and `git rev-list origin/main..main` returned 3 — the
  two facts together explained two of the four complaints and pointed at a
  deploy, not at copywriting.
- **Fetching the provider's real event strings instead of trusting the
  dashboard's labels.** The picker shows "Membership started"; the payload says
  `membership.started`. Both are now in the doc as a table, because the mismatch
  is invisible until a delivery logs `event type not handled`.

## Rules

- A provider's shelf limits (how many of a kind of offer, what may be one-time,
  what may be free) are UI facts. Check them in the dashboard *before* writing
  copy for them, never after.
- When one string is shared by two repositories, each copy names the other's
  path in a comment. Nothing else can catch the drift — there is no import to
  follow and no test that spans both.
- Assert on the constant, never on the literal it currently expands to. A test
  that hardcodes a name is a rename detector, not a behaviour test.
- Copy for someone else's dashboard carries its measured character count in the
  doc. Caps enforced on save with no live counter are found the expensive way.
- An OAuth consent screen with no logo and only non-sensitive scopes needs no
  verification. Adding a logo buys one image and costs a review cycle plus
  homepage requirements.
- Verification checks the *deployed* site. A page that exists only in an unpushed
  commit is a 404 to every reviewer and crawler, whatever the repo says.
- **A reviewer's complaint describes what the reviewer SAW, which is not
  necessarily what the site serves.** Google rejected the homepage three times
  for "does not explain the purpose of your app" and a name mismatch. Both were
  true of a Cloudflare interstitial: `HeadlessChrome` is in this zone's own
  `BLOCK_UAS`, the review drives a headless browser, and every fetch got
  `cf-mitigated: challenge` and `<title>Just a moment...</title>`. Two rounds of
  homepage copy were written before anyone fetched the page *as the reviewer*.
  One `curl -A HeadlessChrome` would have settled it at the start, and this zone
  had already lost two webhook providers at the edge for the same class of
  reason. Reproduce the client before rewriting the content.
- `sr-only` satisfies a crawler, never a human reviewer. The homepage h1 named
  the site and said what it does, invisibly, while the header wordmark was
  `hidden sm:inline-block` — so at a phone viewport the page showed a poster wall
  with no name and no purpose, and the brand review said exactly that. Anything a
  reviewer is asked to confirm has to be visible at the smallest breakpoint.

Related: `docs/buymeacoffee-setup.md` for the fields themselves, and
`social-media-downloader/lessons/2026-08-15-buymeacoffee-webhook.md` for the
webhook's own history — including the shelf mistake this repeats.
