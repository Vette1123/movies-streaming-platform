# Back flashed pictures it already had

## What

Back to a page looked like the images reloaded. Measured on production it made
zero image requests, and wsrv sends `max-age=31536000`, so nothing was reloading.
The flash was the rebuild: posters veiled at opacity 0 and faded in, six rail
cards replayed their entrance, and the static rail's swap to the real list
veiled six more, 5s after you arrived.

`lib/image-memory.ts` now remembers what the tab has shown and holds an `Image`
for each (LRU of 300), so a rebuilt picture has no veil, loads eager and decodes
sync. A rail rebuilt by Back has every poster and no entrance, the hero copy does
not rise in, and a wordmark already shown is not covered by the plain title.

| First frame after Back, 412x823 | Before                | After |
| ------------------------------- | --------------------- | ----- |
| Veiled images on screen         | 3, then 6 at the swap | 0     |
| Cards replaying the entrance    | 6                     | 0     |
| Unfinished images, empty boxes  | 0                     | 0     |
| wsrv requests                   | 0                     | 0     |

## Mistakes

- The user said images were not cached and I nearly went after cache headers and
  the service worker. One sampled Back showed zero requests. The report described
  what it looked like, not the cause.
- The existing "skip the fade if complete" check looked like it covered this. A
  `loading="lazy"` image is not complete at mount however cached it is, so the
  comment promising no flash on a cached scroll was only true for eager images.
- #134 said a full-page Back keeps scroll. In `pnpm dev` it landed at 0 and wiped
  the saved place: Strict Mode ran the layout effect twice, and my `isFirstRun`
  guard let the second run call `forgetPage()`. Production has no Strict Mode
  double run, so it passed there, which is why I never saw it.
- I blamed the wrong things in that chase first: an iframe artefact, then
  `useScrollToTop`. A marker on `window` settled it: the click itself was a full
  page load, because a title outside the prerendered set has no RSC payload.

- A place saved in sessionStorage survived a fresh full load, so the next Back
  restored a rail offset from the visit before. The harness caught it only because
  two runs shared a tab: the rail left at 0 came back at 690.
- My production watcher required two strings in one chunk, timed out, and reported
  "not live" for code that was live. It also exited 0 on timeout. A failing network
  made it look plausible. Ask the deploy run, not the scripts.

- I blamed "not prerendered" for every full-page click before checking. Asking
  for the `.txt` payload separates them: 10048 is a real tail title (404), 1560520
  is baked (200), and the one full load of 1560520 came right after a deploy.
- A full-page Back with no bfcache kept scroll but lost rails and replayed the
  entrance. It now marks `<html data-returning>` before paint and restores rails
  after hydration. The slide stays at 1 on purpose: the server renders slide 1, and
  jumping to the saved one after paint is a worse flash than the reset.

## What worked

- Sampling on a MessageChannel loop every 16ms. rAF does not run in the hidden
  automation tab, but computed opacity and class lists still report.
- `window.__marker` survives a client navigation and bfcache and dies on a
  reload, so it names which of the three Backs you are in. On production the
  full-page case is bfcache, and it restored exactly.
- Comparing the path instead of a first-run flag deleted a ref and fixed it.

## Rules

- Before fixing "not cached", count the requests. No requests means the flash is
  yours.
- `img.complete` at mount says nothing about the cache for a lazy image. Know the
  answer before commit, from your own record.
- There are three Backs: client rebuild, bfcache, document load. Test each; a
  `window` marker and `navigation.type` tell them apart.
- A mount-once guard written as a flag breaks in Strict Mode. Compare the value.
