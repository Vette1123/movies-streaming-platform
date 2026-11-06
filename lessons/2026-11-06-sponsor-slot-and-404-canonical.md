# Sponsor slot, and the 404 that claimed to be the homepage

## What

- Bing: "a large number of pages pointing to the same canonical URL". 200 of 200
  random sitemap URLs had a correct self-canonical. The culprit was the 404 page:
  `app/not-found.tsx` inherited the root layout's `canonical: https://www.reely.space`,
  and it is served under every unknown URL. It now spreads `shellMetadata`
  (`alternates: null`), like the four fallback shells. `tests/not-found-canonical.test.ts`.
- A sponsor slot, ported from social-media-downloader's PromoSlot: `config/offers.ts`
  (catalogue), `lib/offers.ts` (select / href / rel), `components/sponsor-card.tsx`
  (under the player once something plays; never for supporters), `/advertise`,
  a README section, and `pnpm sponsor:stats` for the numbers a sponsor asks for.
  Added over the downloader: a `from`/`until` booking window and a coupon on the card.

## Mistakes

- Four places on the site promised "no ads" / "ad-free". A sponsor card would have
  made each of them false the day it shipped; caught by grepping the claim before
  building, and rewritten to "no ad networks" plus the one card.
- The first card layout put "Advertise here" on its own row, adding height under
  every play for a link almost nobody clicks; moved into the label row.
- The worst-case pass found the actions row `sm:flex-nowrap` overflowing a narrow
  card, then the coupon chip, then (at 288px, 125% font) the CTA and the code. Each
  was invisible with demo copy.
- Turbopack refuses a worktree whose `node_modules` is a symlink outside its root
  ("Could not find the Next.js package"). Verified with a local-only
  `turbopack.root` pointing at the main checkout, reverted before commit.

## What worked

- Sampling the sitemap against production first: it proved the real pages fine in
  one command and pointed straight at the one template that was not.
- Reusing `shellMetadata` instead of a second `alternates: null`.
- The /advertise preview is the real `SponsorCard` with `preview`, so the page
  cannot drift from what ships and counts no fake impressions.

## Rules

- Any page served under many URLs (404, fallback shells) must not inherit the root
  canonical.
- A booked sponsor is one `OFFERS` entry: referral `href`, `coupon`, `from`/`until`,
  `weight: 10`. Copy limits are pinned in `tests/offers.test.ts`; longer copy gets
  edited, not shipped.
- Refresh `/advertise` numbers with `pnpm sponsor:stats --write` before quoting them.
