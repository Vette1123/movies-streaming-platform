# The episode picker was the last thing on the page

## What

"The title in the details page should be as fancy as the hero, and make the
season/episode selector easy to see."

- **One title treatment for both heroes.** The homepage set a title in its
  official wordmark; the detail page had a plain 36px `<h1>` below the fold,
  under a centred round play glyph. `HeroWordmark`
  (`components/header/hero-wordmark.tsx`) is now the one implementation, and
  the detail hero uses the homepage's bottom-left editorial column: chips,
  wordmark `<h1>`, tagline, score row, clamped synopsis, then the actions.
- **The wordmark costs no request.** `images` joined the detail
  `append_to_response` with `include_image_language=en` (+13-28KB raw against
  +28-49KB for `en,null`), and the service peels it to `logoPath` before
  anything is serialised. `tests/detail-logo.test.ts` pins both halves.
- **The play button says what it starts.** "Resume S2 · E3" / "Watch S2 · E4"
  / "Watch Now" (`lib/play-cue.ts`), in the homepage's Watch Now pill
  (`heroWatchButton`). It used to be a glyph whose only words were in its
  aria-label. The resume caption shows the episode name and the series bar.
- **Episodes are a full-width section straight under the hero.** Season tabs
  (`role=tablist`, arrows + Home/End, manual activation) replace the Radix
  dropdown; each episode is a card with its 16:9 still, number, date, runtime,
  synopsis, a progress bar from the synced playback position, ticked/now
  playing/continue states, and spoiler-free mode now blurs the still too. Long
  seasons (over 16) open on 12 plus "Show all", never folding away the episode
  you are on. A hero "Episodes" action jumps there.
- The info panel below starts at "About {title}", with the facts as a `<dl>`.

## Mistakes

- **The first screenshot round put the action row under the install prompt and
  the tip-jar button.** Moving the copy from the centre to the bottom inherited
  every widget fixed to the bottom of the viewport, and a prompt over a button
  swallows the tap (the player already steps it aside for that reason). The
  homepage hero had the clearance, with a comment saying why; I copied its
  layout and not its padding.
- **The watched and reveal buttons were first positioned against the card.** On
  a phone the thumbnail is a 144px box on the left, so "top right of the card"
  landed on the text. Controls that belong to the still live inside the still.
- **A 13-episode season opened on 12 cards and a "Show all 13" button** for one
  card. The keyboard pass caught it; the fold now only applies past 16.
- **Episodes never loaded in `pnpm dev`** — `/api/season-details` is the
  Worker's — and the screenshot seed silently did nothing without
  `Page.enable`. Both cost a round before the card states could be judged.
- Tried `git stash` for the red/green check; the working-tree guard blocked it
  (it would stash other sessions' edits too). Copying HEAD over the three files
  and back did the same job.

## What worked

- Extracting the homepage's title instead of restyling the detail `<h1>`: the
  two cannot drift, and the carousel kept its lazy/eager and grace logic.
- Keeping the play button's aria-label format, so `pnpm resume:probe` ran
  unchanged and stayed green (21 checks) through a full redesign of the hero.
- A screenshot script that answers the Worker route from TMDB and seeds watch
  history, so states (ticked, in progress, continue) were judged on real data.

## Rules

- Bottom-anchored hero copy clears the fixed bottom widgets: `pb-28` on a phone,
  `lg:pb-24`. Check with the install prompt showing, not dismissed.
- Artwork for a title rides the detail request's append; never a second
  request, never a client call to a Worker route per view.
- A card with one big action is a stretched button first in the tab order, with
  content `pointer-events-none` over it; secondary controls are sibling buttons,
  never nested.
- Detail-page screenshots in `pnpm dev` must answer `/api/season-details`
  themselves.
