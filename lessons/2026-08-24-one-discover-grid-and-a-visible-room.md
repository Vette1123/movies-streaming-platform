# One discover grid, and a room you can see before you press play

Date: 2026-08-24
Area: `components/media/discover-grid.tsx`, `app/mood/page.tsx`,
`components/details-hero.tsx`, `components/watch-together-bar.tsx`,
`app/match-night/page.tsx`

## What

Continuing the same "make the rooms work" pass as
[the card-identity lesson](2026-08-24-card-identity-and-the-hidden-search.md).

- `DiscoverGrid` replaces `GenreMediaGrid` and the mood page's private copy of
  the same query + sentinel + error branches. Filter set, cache key, optional
  prerendered page 1 and empty message are props.
- Mood results now render at the site's column scale (2 on a phone, not 3) and
  drop TMDB's cross-page duplicates.
- Mood cards line up: a `<button>` centres its content vertically when the grid
  stretches it, so titles in one row sat at different heights. `flex-col` fixes
  it. Picking a mood scrolls the results into view.
- The Watch Together bar mounts with the page rather than with the player, so a
  host can send the invite before pressing play and a guest can see the room
  exists. Its guest poll idles while there is no frame to steer.
- Match Night announces matches keyed by `type:id`, and seeds that set from the
  first payload after joining instead of announcing it.

## Mistakes

**The mood page was written as a copy and nobody said so — including the copy
itself.** Its header comment read "mirrors GenreMediaGrid's infinite pattern
(same prefetch margin, same empty-page stop)". That comment is the second
occurrence announcing itself, in writing, and it still shipped as a copy. The
copies had already drifted in the ways copies do: three columns on a phone
where the rest of the site uses two, and only one of the two guarding anything.
A comment saying "same as X" is a request to extract X.

**Neither copy deduped, and the symptom was invisible.** TMDB discover pages
overlap — the same title comes back on page 2 and page 3 as popularity shifts
under the cursor — so an infinite list renders a card twice and React logs a
duplicate key. Nobody scrolls four pages in a manual check, so it never
appeared in one.

**"Infinite scroll is broken" was the harness again.** `window.scrollTo(0,
document.body.scrollHeight)` jumps the viewport past the sentinel between two
frames, and an IntersectionObserver only samples frames: the element is never
seen intersecting, so nothing fetches. The genre page — untouched, live for
months — failed the same way, which is what proved it was the test. Scroll in
300px steps and both paginate. Third harness artifact this week after the
desktop user-agent and the unhydrated `goto_url`.

**The room only existed once you pressed play.** The bar carries the invite
link, and it was gated on `isIframeShown`, so the host page after
`/watch-together` looked like an ordinary detail page — the code was in the URL
and nowhere on screen. Gate a control on what the URL says, not on what some
other component is currently doing.

## What worked

- Deleting `GenreMediaGrid` outright rather than leaving it as a wrapper: one
  name, one file, and the genre page reads as a caller of the same component
  the mood page calls.
- Comparing a new surface against an old one in the same harness session. The
  old surface is the control group, and it is what turns "my change is broken"
  into "the test is broken" in one command.

## Rules

- A comment that says "mirrors X" is the extraction signal. Write the shared
  component instead of the comment.
- Any paginated TMDB list dedupes by id — the API repeats rows across pages by
  design.
- Test infinite scroll by scrolling, in steps. A jump to the bottom skips the
  frames an IntersectionObserver samples.
- Before believing a new page is broken, run the same check against an existing
  page that does the same thing.
