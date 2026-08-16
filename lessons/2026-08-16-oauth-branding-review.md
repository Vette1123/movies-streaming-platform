# Google OAuth branding review: metadata is not the homepage

**Date:** 2026-08-16

## What

Google's OAuth branding verification rejected reely.space twice, on two grounds:
"your homepage does not explain the purpose of your app", and "the app name
'Reely' configured for your OAuth consent screen does not match the app name on
your homepage". The scopes involved are only `openid email profile`, so this is
purely a branding review — nothing sensitive or restricted.

The fix that finally addresses the first ground: the homepage `h1` is no longer
`sr-only`. It renders as a visible line under the header, absolutely positioned
so the hero keeps its full height.

## Mistakes

- **Answered a screenshot with metadata.** Round after round went into `<title>`,
  `og:site_name`, `application-name`, the manifest, and `WebApplication` JSON-LD.
  Every one of those is machine-readable and every one of them was already right.
  The rejection is about what a reviewer *sees*: the first screenshot of the
  homepage was a poster carousel and a six-letter wordmark, with no sentence
  anywhere on it saying what the site does. The purpose statement existed — in
  the footer, four screens down.
- **`sr-only` treated as "present".** For SEO it is present. For a human or a
  vision-model reviewer looking at a screenshot it does not exist. An accessible
  heading and a visible claim about the product are two different deliverables,
  and one does not substitute for the other.
- **Reverted the one change that was on target.** An earlier attempt added a
  visible explainer block to the homepage (`6ddad5a`), then reverted it
  (`331a705`) because it cost the hero its full height. Correct instinct, wrong
  conclusion: the block was the right idea in a layout-breaking form. Absolute
  positioning under the fixed header gives the same visible sentence for zero
  hero height and no CLS. The revert threw the requirement out with the layout.
- **Blamed the WAF longer than the evidence justified.** The scraper-challenge
  rule genuinely did serve a challenge page to a headless reviewer, and it was
  worth relaxing (`78dedcf`, `69be174`). But once the page loaded, the page still
  did not say what it was — the WAF explained a failure mode we had, not the one
  they reported.

## What worked

- Reading the rejection text literally: "does not explain the purpose" means
  visible prose, "does not match the app name" means the name in the viewport.
  The header wordmark fix (`69be174`, name shown below `sm` too) was the correct
  read of the second ground, and it stands.
- Verifying in a real browser at 390px and 1440px before pushing. The mobile
  viewport is what an automated reviewer screenshots, and the mobile viewport is
  where both problems lived.

## Rules

- A verification reviewer sees a screenshot. If a claim about the product is not
  visible above the fold at 390px wide, it is not on the homepage — no amount of
  correct metadata substitutes.
- Keep the page-level `h1` visible on a marketing/landing surface. `sr-only` is
  for headings that duplicate visible structure, not for the only statement of
  what the product is.
- When a visible element conflicts with a full-bleed hero, position it out of
  flow rather than deleting it. `absolute` + `pointer-events-none` under the
  fixed header costs no height and eats no taps.
