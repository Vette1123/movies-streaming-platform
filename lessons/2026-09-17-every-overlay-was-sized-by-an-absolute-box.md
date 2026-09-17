# 2026-09-17 — Every overlay, hero, and track was sized by an absolute box

## What

A mobile-viewport sweep across every overlay and the homepage hero: dialogs,
sheets, alert dialogs, the search command menu, the filter panel, the carousel
track, and the hero slide. All of them positioned or sized their content with
`absolute inset-0` against a parent that had no height of its own, or capped
themselves with `vh` (not `dvh`), so on a phone with a keyboard open — or just a
short viewport — content either overflowed off screen or sat behind the
keyboard. `100dvh` everywhere, a shared `DIALOG_SCROLL_GUARD`
(`overflow-y-auto overscroll-contain`) applied by the shared `DialogContent` /
`AlertDialogContent`, `min-h-0` on every flex child that scrolls, safe-area
insets on sheets, and the hero slide rebuilt from absolute positioning into
normal flow (`min-h-[inherit]` threading the carousel's stage height down).

## Mistakes

- The first instinct was to fix each surface in place. Eleven files in, the
  pattern was identical every time — absolute positioning against an
  unsized parent, `vh` where `dvh` was needed, a missing `min-h-0` — and the
  fix lives in the four shared primitives, not in the callers.
- `pnpm prettier:check` failed on 38 files **with the changes stashed** —
  the debt predates this work. Do not format 38 untouched files into a
  viewport commit; the diff must stay reviewable.
- `pnpm preview` in the foreground returns nothing useful and a port-guess
  (8787) 404s — wrangler picks **8788**. Read the log line, don't assume.
- `next dev` 404s on `/api/*` are not a regression: those routes only exist
  in the Worker. Verify API paths against `wrangler dev`, pages against
  `next dev`.
- A stale dev server on :3000 (PID from a previous session) silently makes
  `pnpm dev` attach to a build without these changes. Check the port first.

## What worked

- One shared constant (`DIALOG_SCROLL_GUARD`) applied inside the two content
  primitives, with a `scrollable={false}` escape hatch — every dialog got the
  fix by importing nothing and changing nothing.
- The `command.tsx` mobile query gaining `(pointer: coarse)` — a tablet with a
  keyboard is still a touch screen, and the keyboard-aware layout is about the
  on-screen keyboard, which follows the pointer, not the width.
- The hero poster sizing to `min(28vw, 400px, calc((100svh-12rem)*2/3))`
  instead of a fixed height: the poster can never be taller than the viewport
  allows, and the `sizes` hint stays a flat 470px.
- `min-h-[inherit]` as the thread that carries the carousel stage's height
  through absolutely-free children — the stage keeps `min-h-svh`, the slide
  keeps `min-h-[inherit]`, and the content stops needing to know either.

## Rules

- An overlay's content box is `max-h-[calc(100dvh-2rem)]` with an internal
  scroll region — never a fixed `vh` height with `overflow-hidden` and no
  scroll child.
- Never size a child with `absolute inset-0` when the parent's height comes
  from its content; use flow (`min-h-[inherit]` / `flex-1` / `min-h-0`) and
  let the box own its own height.
- `dvh` over `vh` anywhere a mobile keyboard or browser chrome can be present,
  which is everywhere a user types or scrolls.
- Before a viewport fix: screenshot the failure, then fix the shared primitive,
  then re-screenshot. One surface at a time is how eleven files of the same
  bug happen.
