# Back should return you

## What

Opening a title unmounted the page, so Back rebuilt it at slide 1 with every rail
at the start. Back now restores the hero slide, each rail and the page scroll,
site-wide. Only Back does it: the logo or a nav link starts the page fresh.
Position lives in sessionStorage for the visit (`lib/back-restore.ts`), and the
app owns restoration with `scrollRestoration = 'manual'`
(`components/back-restore.tsx`).

Measured at 412x823, before and after a round trip: slide 4, rail 736, y 1388,
rail top 268, all identical on two round trips. `/movies` after infinite scroll:
y 1918, same poster on screen. Logo: slide 1, rail 0, y 0.

## Mistakes

- Asked the user a product question the research could answer, and they had to
  send me to look. NN/g already says same session, same content, easy reset.
- Called page scroll "likely lost" from the code. In desktop Chrome it survived;
  the slide and rail were the real, reproducible losses.
- Stopped restoring at the first scroll that landed. The page ended 228px off and
  the saved number looked correct. Only measuring the rail's position on screen
  showed it, because the y alone just read "a different number".
- Suspected Next or a stray scroll call. Patching every scroll API showed only my
  own call: it was scroll anchoring, which no JS trace can show.

## What worked

- A scripted round trip in an iframe at phone size, red first, then the same
  script for the fix.
- Comparing where the element sits on screen, not just the scroll offset.
- Keeping the restore answering every height change until the page settles or the
  visitor touches it, which also deleted code.

## Rules

- Taking `scrollRestoration` over is site-wide: test the infinite-scroll route.
- Restore only on a history move. A forward visit clears the saved place.
- Check a restored position by what is on screen.
- The server always renders slide 0, so only a client rebuild can restore a
  slide. A full-page Back keeps its scroll, not its slide.
- Not proven on a physical phone gesture: the harness drives `history.back()`.
