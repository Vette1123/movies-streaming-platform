# The copy was careful and the image was not

**Date:** 2026-08-31
**Area:** marketing — awesome-list PRs, OpenAlternative, Product Hunt

## What

Second marketing round on top of `lessons/2026-08-31-marketing-round.md`. No
product code, one asset change.

- Two new awesome-list PRs, each following the target's own rules:
  **Clone-Wars** #303 (36.7k ★ — "Clones and Alternatives" table, alphabetical
  after the IMDB row, described as an IMDB / JustWatch alternative) and
  **awesome-no-login-web-apps** #571 (3.3k ★ — bottom of Miscellaneous, PR
  template checkboxes filled, and it qualifies without their `[Account]` tag
  because the sign-in is optional sync).
- **OpenAlternative** submitted on the free queue. Picked because an approved
  listing is auto-published into `piotrkulpinski/open-source-alternatives`
  (6.7k ★): one form, two placements.
- **Product Hunt** (still scheduled Tue 8 Sep 2026): replaced the first gallery
  image, deleted the old one, added three shoutouts (Cloudflare Workers,
  Next.js, shadcn/ui).
- **The OG card was rewritten** — `app/_og/source.tsx`, `app/_fonts/load.ts`,
  `public/opengraph-image.png`.
- Five candidate lists rejected with the reason written into the kit, so the
  next round does not re-evaluate them.

## Mistakes

- **The launch kit forbade words the product was shipping in an image.** The
  kit's one non-negotiable rule bans "free movies", "no subscription needed"
  and every paywall framing. The OG card — every unfurl, and the first image on
  the PH draft — said "FREE TO STREAM / Watch movies & TV shows. Free. … no
  signup, no paywall". The rule was written for text to paste into forms and
  never applied to the assets, which is where the most-seen copy lives. A copy
  rule that only covers Markdown is not a copy rule. Grepping the repo for the
  banned phrases found the rule itself and nothing else, because the image
  copy lives in JSX as separate strings — grep the _rendered_ asset's words,
  or just look at the image.
- **Opened the browser before finishing the read.** Four of the seven candidate
  lists were disqualified by a file already in their repo — a taxonomy YAML
  with seven mobile-only stack values, a criteria line requiring a for-profit
  company, a README that had been replaced with an unrelated list. Reading
  `data/taxonomy/stacks.yml` cost one API call; writing a record and a PR
  against it would have cost an hour and been closed.
- **Lost a set of Product Hunt gallery edits to a stray click.** Dragged the new
  image into first place, then clicked a thumbnail to select it before saving;
  the click landed on the page behind and navigated to /notifications, and the
  unsaved reorder was gone. On a form that says "You've got unsaved changes",
  save between steps rather than after them.
- **Two wasted attempts to type into a field.** `computer type` types into
  whatever has focus, and clicking with viewport coordinates instead of
  screenshot coordinates put the focus somewhere else entirely — the text went
  into the previous input. `form_input` with the element ref set it first try.
  Use `form_input` for anything that is a real form control.

## What worked

- Reading the target's CONTRIBUTING _and_ its taxonomy/data files before
  writing anything. Every "not worth it" entry in the kit now carries the
  specific rule that disqualifies it, which is what makes the list durable.
- Writing down the rejected lists, not just the accepted ones. The next round's
  work is mostly _not_ re-opening these.
- `gh api repos/<x>/contents/<file> --jq .content | tr -d '\n' | base64 -d` to
  read a list's rules without cloning it. (The `tr` matters: the API returns
  base64 with newlines and `base64 -d` rejects them on this box.)
- Keeping the honest framing paid off twice: awesome-piracy (26.9k ★) is the
  one list Reely would sail into, and staying out of it is worth more than the
  backlink.

## Rules

- **The positioning rule covers rendered assets, not just prose.** OG cards,
  screenshots, gallery images, video thumbnails. Look at the image after
  changing it.
- **Never write a status-table cell a command can produce** (still true from
  round one — PR numbers came from `gh pr create` output this time).
- **Read a list's data files before writing a PR to it.** `CONTRIBUTING.md` says
  what they want; `taxonomy/`, `criteria`, and the README's own sections say
  what they will accept.
- **Do not submit to a list whose framing redefines the product**, however many
  stars it has.
- On any web form worth more than a minute of work: `form_input` by ref, and
  save between steps.

## Related

- `lessons/2026-08-31-marketing-round.md` — round one (the PRs still open, the
  copy, the AlternativeTo and Product Hunt setup).
- `docs/marketing/launch-kit.md` — the copy, the channel tiers, the status
  table and now the rejected-list reasons.
