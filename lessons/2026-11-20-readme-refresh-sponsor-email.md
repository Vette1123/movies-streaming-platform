# README refresh and a sponsor slot booked by email

## What

A highlighted "Sponsor Reely" block now sits under the films: one mailto whose
subject (`Reely sponsor slot`) matches `sponsorMailto()`, so the Gmail filter
answers it with a template. GitHub Sponsors links left the README; supporters
email too (`Reely Pro — Any plan`, already auto-replied). The rest of the README
was checked against the code: the intro now sells what Reely is (four ratings,
player, Next Up, lists, Watch Together, Kodi), the features list gained
accounts and sync, lists and RSS, alerts, Match Night, Mood, Reels, Compare,
stats and the Kodi add-on, the false "no login, nothing stored on a server"
became "no account required", and the stale tooling (TS 6, pnpm 10, Node 20,
Husky, Renovate), the RSC caching line and the local-deploy commands were fixed.

## Mistakes

- The first draft said Pro was "switched on by hand". The owner's rule is
  "once the payment is done"; the memory said so and the draft missed it.
- The audit listed every feature from route folders. Match Night's copy was
  guessed ("swipe") before the page title was read ("Pick a Movie Together").
  Read the page metadata before describing a feature.

## What worked

One edit script with an `assert old in s` per replacement, then prettier: an
already-applied edit failed loudly instead of being written twice.

## Rules

- A README mailto uses the same subject as the site's button, so the Gmail
  auto-reply catches it. Change one, change the filter.
- The README never links a payment page; sponsors and supporters email.
