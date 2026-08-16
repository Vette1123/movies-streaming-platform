# Making support findable (and not selling it to people who already bought)

**Date:** 2026-08-16

## What

The support page existed and nothing pointed at it. The account menu actively
hid it from supporters, the footer carried a bare "Support Reely" link that said
neither what it costs nor what it buys, and a visitor who never signs in — most
visitors — had no route to it at all.

Shipped:

- **Footer** rewritten: brand paragraph, a `Site` link column, and a bordered
  support card carrying the three prices and a real CTA. Also fixed a link
  labelled "Cloudflare" that pointed at `vercel.com`.
- **Mobile drawer**: a "Support Reely" section above the account section, shown
  to everyone, signed in or not.
- **Header**: a heart icon linking to `/support` at `md` and up, rendered for
  supporters too (for them it is where the plan is managed).
- **`/support`**: supporters get a plan panel — what they are on, what changing
  to yearly or lifetime costs, and the one Buy Me a Coffee link that can change
  it — instead of four sections of pitch (`components/support/plan-view.tsx`).
- **Watchlist and watch history**: a support prompt under the list, saying what
  paying would add to the feature the visitor is already using
  (`components/support/support-prompt.tsx`). Hidden from supporters.
- Account menu keeps `/support` for supporters, relabelled "Your plan".

## Mistakes

- **Passed a component as a prop across the RSC boundary.** The prompt took an
  `Icon` prop and the two callers are Server Components, so
  `<SupportPrompt Icon={RefreshCw} />` handed a function to a Client Component.
  Both pages went straight to the error boundary — "Something went wrong",
  client-side only, SSR HTML fine, no overlay, nothing in the page. Diagnosed by
  stashing the two page files and reloading: worked. The fix is a string key
  (`icon="sync"`) resolved to a component inside the client module.
- **The first browser check proved nothing.** The prompt was absent from the
  watchlist and that looked like a bug, then like a pass. It was neither: the
  browser was signed in as an owner-seeded supporter, so `pro` was true and the
  component correctly rendered nothing. Every check of a conditional-by-account
  surface has to state which account it is checking as.
- **Faking a supporter needs both halves.** Writing `reely_profile` into
  localStorage was not enough: the header's `useAccountSession` sees no hint
  cookie, calls `markSignedOut()`, and the cache goes with it. The hint cookie
  (`reely_account=1`) plus the cached profile is what makes `pro` true.
- **`Emulation.setDeviceMetricsOverride` is per target.** Set before `new_tab()`
  it applies to the tab being replaced, and the screenshot comes back at desktop
  width. Navigate first, override second.
- A pricing card that had grown a third row was still introduced by the words
  "Two ways to do it".

## What worked

- Reusing `SupporterGate` for the new prompts rather than designing a second
  panel: same offer, same shape, wherever it is met. It gained two optional
  props (`Icon`, `cta`) and no caller changed.
- Rendering the header's support link unconditionally. A control that appears
  after hydration shifts the icons beside it; one that is always there does not,
  and it is still the right destination for a supporter.
- Keeping the full pitch in the prerendered HTML and swapping to the plan panel
  only once the browser knows who is looking — crawlers and Google's brand
  reviewer read the complete page, which matters while verification is pending.

## Rules

- Never pass a component, function or class instance from a Server Component to
  a Client Component. Pass a key and resolve it on the client.
- Anything gated on account state gets verified twice, once as each kind of
  visitor, and the state is stated out loud before reading the result.
- Faking account state locally: `reely_account=1` cookie **and** a `reely_profile`
  in localStorage. Either alone reads as signed out.
- When a numbered phrase introduces a list ("two ways", "three reasons"), it is
  a fact about the list — recount it whenever the list changes.
