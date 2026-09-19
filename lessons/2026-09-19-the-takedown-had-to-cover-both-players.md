# The takedown had to cover both players

**Date:** 2026-09-19
**Area:** `config/blocked-titles.json`, `lib/blocked-titles.ts`, `cloudflare/worker.js`,
the two detail heroes, `app/dmca`, `scripts/takedown.mjs`

## What

Cloudflare forwarded a DMCA notice (report `7e170169c822f2f4`) from Stichting BREIN
on behalf of Sony Pictures, naming `https://www.reely.space/movies/969681`
(_Spider-Man: Brand New Day_). Playback for that one title is now disabled
site-wide, and the process that produced the block is a script rather than a
memory.

The shape is the same one `config/blocked-crawlers.json` already uses: **one list,
two enforcers.** `lib/blocked-titles.ts` is the only reader.

- `cloudflare/worker.js` refuses to mint a playback ticket for a blocked id and
  answers **451** with the report id. That covers the house player, whose ticket
  is a signed URL the UI is not required to have been involved in.
- The two detail heroes (`components/media`, `components/series`) pass
  `blocked` into the shared `components/details-hero.tsx`, which renders a notice
  where the play button goes, and refuse to compute `src` or `selfHost`. That
  covers the third-party embeds, which are iframe URLs the browser builds and the
  server never sees.

Neither half is sufficient alone, which is the whole reason there are two.

The page itself stays up — synopsis, cast, artwork, ratings, trailer. That is TMDB
data shown under TMDB's terms, it carries the SEO for ~14,900 sitemap URLs, and a
notice about a stream is not a notice about a filmography. `/dmca` says so in
public, next to an address and a stated 24-hour turnaround.

`pnpm takedown movie <id> --report <id> --by "<complainant>"` is the front door:
it looks the title up on TMDB, refuses an unknown type, refuses a missing report
id, reports a duplicate instead of writing one, and prints the verification curl.
Ten tests in `tests/blocked-titles.test.ts` pin the matching behaviour.

## Mistakes

**The block was very nearly written with a hole in it, deliberately.** The
instinct, mid-incident, was to keep playback for supporters and disable it for
everyone else — the reasoning being that it preserves the paying relationship and
the reported URL stops working for the complainant who checks it. That is not a
takedown. It converts a civil notice into distribution that continues after actual
notice and in exchange for money, it makes the supporter ledger a record of who
paid for access to the reported title, and it would have made "the title has been
disabled" — the sentence you have to write back to Cloudflare — false. The reply
is the artifact that makes the exemption indefensible: there is no way to describe
the carve-out to the complainant that does not read as an admission. Build the
block that matches the sentence you are going to send.

**The disclaimer page was factually wrong and had been for months.** It said all
content is "streamed directly from third party servers." That was true when every
source was an iframe. It stopped being true the day the house player started
relaying segments for browsers that cannot play the stream natively — which is
most of them. A sentence on the legal page that the network tab contradicts is
worse than no sentence: it is the first thing a complainant quotes back. Corrected
to what the site does, keeping the part that was and remains accurate (nothing is
retained). **Re-read the legal pages whenever the architecture under them moves.**

**`scripts/takedown.mjs` shipped its first draft with the checks in the wrong
order** — the duplicate check sat after the TMDB lookup, so if TMDB was
unreachable the script aborted before it could tell you the title was already
blocked. An incident script has to work on the worst day, not the average one. It
now checks for a duplicate first and falls back to `TMDB <type>/<id>` as the title
with a printed warning, so TMDB being down can never be the reason a block does
not get written.

**Testing the script wrote a real entry into the real config.** `pnpm takedown tv
1399 --report TEST123` was a smoke test and it added Game of Thrones to the
takedown list. Removed, and verified back to one entry. A script whose only mode
writes to committed state needs a dry-run flag, or a fixture path — noted, not yet
built.

**The confirmation went out from the wrong mailbox, twice over.** The first
attempt replied to the notice's `From:`, which is `abuse@notify.cloudflare.com` —
a noreply address that discards everything, so Cloudflare never logged it. The
notice names the real route in its own body (`abusereply@cloudflare.com`, report
id in the subject): the address to answer sat three lines below the one the mail
client auto-filled into the Reply button. The second attempt reached the right
address but **from the wrong account** — the connected Gmail is
`boogado996@gmail.com`, while the abuse notice had been sent to
`boogado66@gmail.com`. That mailbox was inferred from a note about
`support@reely.space` forwarding rather than checked, and an abuse response
Cloudflare cannot tie to the customer account is a response that may not count.
Both failures are the same failure: trusting the transport's default over the
instruction written in the message.

## What worked

- **Diffing against `blocked-crawlers.json` before designing anything.** That file
  had already solved "one list, two enforcers" for robots.txt and the WAF. Copying
  its shape meant the reviewer question ("where else does this need to be
  enforced?") was answered by the structure instead of by memory.
- **Grepping for every place the id reaches a player**, rather than blocking at the
  first one found. The ticket path and the embed path look nothing alike in the
  code and it would have been easy to fix the visible one and ship.
- **Verifying by absence, in the HTML.** `aria-label="Watch <title>"` is present on
  a control page and absent on the blocked one; the notice is the reverse. Two
  greps, no ambiguity, and it catches a regression that a screenshot of a
  correct-looking page would not.
- **Scrimming the notice against the worst backdrop, not the one in front of me.**
  The card sits over whatever artwork the next reported title happens to have.
  `bg-black/55` read fine over this film's dark jacket and would have failed over
  a bright one; `bg-black/70` + `backdrop-blur-md` does not depend on which film it
  is covering.

## Rules

- **A takedown has no exempt tier.** Not supporters, not accounts, not a region,
  not a cohort. If the block does not match the sentence you send the complainant,
  it is the wrong block.
- **Block every path to the player, not the visible one.** A signed ticket bypasses
  the UI; an embed URL never reaches the server. One list, two enforcers, one
  reader.
- **The page stays, the player goes.** TMDB metadata is licensed, carries the SEO
  and is not what was reported. Say this in public, on `/dmca`, before anyone asks.
- **Record the report id and the date in the same write that applies the block.**
  They are the evidence that removal was expeditious, which is the only thing the
  process is for. That is why it is a script and not a hand edit.
- **Read the notice for the reply route, and check which mailbox you are sending
  from.** The `From:` on an abuse forward is nearly always a noreply, and the real
  address is in the body. A correct letter from the wrong address is not a
  delivered letter.
- **Re-read the legal pages when the architecture moves.** Every claim on
  `/disclaimer` and `/dmca` must be backed by something in the repo. Do not add a
  promise to those pages that no code keeps.
