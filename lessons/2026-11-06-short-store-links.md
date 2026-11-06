# Short store links

## What

Every companion-app install link (header, drawer, footer promo, command menu,
sponsor card) now goes through `installLink(slug, source)` in `lib/apps.ts`:
`https://<app>.mohamedgado.com/?s=reely` (Rafiq adds `&m=`). The long
`vette1123.github.io/<app>-privacy/go` chooser is gone; `tests/app-promo.test.ts`
fails if it, or the `/projects/<app>/go` path, comes back.

## Mistakes

- The sponsor card shipped (#156) with the short domains hand-written while the
  rest of the site still built the long link: two ways to spell one link. Fixed
  by one helper both use.

## What worked

- Checking each short domain live first: all three answer 200 on the same store
  chooser, so the swap changes no destination.

## Rules

- An install link is `installLink()`, never a literal URL.
