# The sixth rule did not fail, it rejected the other five

**Date:** 2026-09-01
**Area:** Cloudflare WAF / invocation budget, UI sweep, Search Console

## What

Third round of the same day (after `the-fleet-was-ten-strings` and
`a-request-is-not-an-answer`), and the first thing it found is that the second
round never shipped.

`pnpm cf:health 3` on a window that was entirely post-deploy still read
**74,712 invocations/day, 75% of the cap** — better than 91%, but nowhere near
the ~46% the blocked fleet was worth. Grouping tail-page 200s by user-agent
named the reason immediately: **YandexBot 3,328 requests in three hours
(~26,600/day) and Amzn-SearchBot 634 (~5,000/day), all 200s**, against a
`config/blocked-crawlers.json` that had listed both since the morning.

The live ruleset had five rules and none of them was the new one:

```
 1. [block]             block extensions this site never serves
 2. [skip]              allow social scrapers and verified search bots
 3. [managed_challenge] challenge obvious scraper user-agents
 4. [managed_challenge] challenge frozen scraper fingerprints   <- still a challenge
 5. [managed_challenge] challenge non-browser clients on detail pages
```

The CI log had said so, four hours earlier:

```
✗ Custom rules: allowlist + block-scrapers (needs Zone WAF: Edit)
    PUT /zones/…/rulesets/… → 400 50001: exceeded the maximum number of
    rules in the phase http_request_firewall_custom: 6 out of 5
```

**The free plan allows five custom rules in that phase, and a sixth does not
get dropped — the whole PUT is rejected.** So the live ruleset stayed frozen at
whatever it was, and _every other change in the same file went with it_: the
challenge→block escalation from the previous round is still a challenge in
production. Two commits' worth of work, three green deploys, zero effect.

The fix is the boring one: fold the two `block` rules into one. They share an
action and they share a position — both have to sit ahead of `ALLOW_RULE`,
which skips the whole `waf` product for `cf.client.bot`, and Cloudflare verifies
Googlebot-Image (the dead-extension half) and Amazon's and Yandex's crawlers
(the refused-crawler half) alike. Plus a length guard before the PUT and a
non-zero exit when the custom-rules step fails.

Then the UI/UX half, driven in a browser on production:

- **The fixed header is `bg-background/80` with no `backdrop-filter`.** It never
  had one. Eighty percent opaque is not opaque: mid-scroll on a detail page the
  fact list read straight through "Reels / Mood / Match Night / Watchlist".
- Its scroll listener was **not passive**, so the browser waited on a React
  state setter before it could scroll, and it never ran on mount — a page
  restored mid-scroll started with the wrong background.
- **Nav links measured 23px tall**, one pixel under WCAG 2.2's 24×24 minimum
  target size. The `text` button size has exactly one caller.
- **`BlurredImage`'s non-intro `fill` branch had no backing.** The `intro`
  branch grew a dark fill when the hero was blank before its first pixels; the
  branch the person grids and the collection banner use kept the transparent
  hole, so a portrait box showed the page's own starfield through a rounded
  rectangle until the image decoded.
- **The stats panel's "First tracked" was a bare `toLocaleDateString()`** —
  "4/16/2026", the one date shape on the site that matches nothing else on it.
- **The person page cut its biography mid-attribution.** TMDB bios end with
  "Description above from the Wikipedia article X, licensed under CC-BY-SA…",
  and a 1400-character cut on the nearest space landed inside it: Tom Hanks
  ended "Description above from the Wikipedia article Tom…", which both reads as
  broken and drops the credit while keeping the fragment that names it.

## Mistakes

- **Read a `✗` in a CI log as "optional step skipped" because that is what the
  script called it.** `cf-waf-setup` buckets every failed step under "Skipped N
  of the above (missing token perms)", and the token permissions were fine — the
  plan limit was the problem. A summary line that guesses the cause is worse
  than one that just prints the error, because it stops the reader from reading
  the error. It now exits non-zero and says what actually failed.
- **Verified the block with a curl, again, after writing the rule that says not
  to.** `curl -A '<frozen Chrome UA>' /movies/550` returned **403**, which was
  read as "the block is live". It was the _challenge_ rule answering: a
  `managed_challenge` returns 403 to a client that cannot solve one. The
  previous round's own lesson says to grade a WAF rule by the invocation count
  and not by one request, and this round did the same thing before checking the
  actual ruleset.
- **Assumed a green deploy meant the config applied.** Three deploys ran
  `waf:apply` after the change; all three were green; none of them changed
  anything. Idempotent-config-on-every-deploy is only as good as its exit code.
- **Nearly filed the harness's own blind spots as product bugs, twice.**
  `/watch-history` sat on its skeletons for eight seconds with 70 pulse
  elements and no cards — the real content was in a `<div hidden>` and
  `<template id="B:0">` was still in place. Cause: React reveals a completed
  Suspense boundary through `requestAnimationFrame`, and **rAF never fires in a
  tab that is never visible** (`document.visibilityState === "hidden"`, the
  automated tab's permanent state). Same story for every "blank poster": the
  images were `complete` with `naturalWidth: 307`, just not painted. Before
  filing anything visual from this harness, check `visibilityState`.
- **Blamed a Safari 17.4 fingerprint for 16,000 requests/day before reading the
  whole string.** The user-agent column was truncated at 120 characters and the
  suffix was `(Applebot/0.1; +http://www.apple.com/go/applebot)` — it is
  Applebot in its Safari-shaped UA, a crawler that honours `Crawl-delay` and was
  given one that morning. Truncating the field you are about to make a blocking
  decision from is how a search crawler gets blocked by accident.

## What worked

- **Reading the live ruleset over the API instead of the source file.** Five
  rules, wrong actions, no new rule — one query, and it ended a line of
  reasoning that would otherwise have gone looking for a bug in the expression.
- Grouping tail-page 200s by `userAgent` again. It is the same query as the
  morning's and it answered "did the fix land" in one line.
- Driving the sweep with a small DOM audit (overflow, missing alt, unnamed
  controls, sub-24px targets, heading order, duplicate ids) per page rather than
  eyeballing screenshots. It is what turned up the 23px nav links, which no
  screenshot would have shown.
- Putting `trimBiography` in `lib/seo-description.ts` — the module that already
  owns how much of a TMDB blob we show and on which boundary — instead of
  leaving it in the route file, so it could get a test.

## Rules

- **The Cloudflare free plan allows five custom rules per phase, and the sixth
  rejects the whole PUT.** Adding a rule means merging two that share an action
  and a position, not appending. `MAX_CUSTOM_RULES` in `scripts/cf-waf-setup.mjs`
  now fails before the request with that message.
- **A config step that runs on every deploy must exit non-zero when it fails.**
  Otherwise "we re-apply it every time" is a claim, not a guarantee.
- **A 403 does not distinguish a block from a challenge.** `managed_challenge`
  403s anything that cannot solve it, which includes every curl. Read the
  ruleset, or read the invocation count.
- **Never read a user-agent decision off a truncated string.** Applebot's UA is
  a Safari UA with a suffix.
- **In an automated browser, `document.visibilityState` is `hidden` and
  `requestAnimationFrame` never fires.** Suspense boundaries stay unresolved and
  lazy images never load. Both look exactly like a stuck page.
- A translucent fixed header needs `backdrop-blur`. The tint alone is not
  enough at any opacity a header can use.
- Mobile-viewport verification is not available in this harness: `resize_window`
  reports success and changes nothing, and `window.open` with size features is
  blocked. Desktop plus programmatic checks is the honest ceiling.

## Related

- `lessons/2026-09-01-a-request-is-not-an-answer.md` — the round whose WAF
  changes this one discovered had never applied.
- `lessons/2026-09-01-the-fleet-was-ten-strings.md` — the challenge that is
  still a challenge in production until this deploy lands.
- `config/blocked-crawlers.json` — the list, and why each group is on it.
