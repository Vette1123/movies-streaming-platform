# The weird border was three surfaces, not one card

**Date:** 2026-08-31
**Area:** account settings, in-player settings, `lib/surfaces.ts`

## What

Reworked the settings surface and put the playback settings on the page that is
playing.

- `lib/surfaces.ts` — one raised-surface recipe (`surface`, `surfaceHover`,
  `surfaceDivide`) instead of a border/background pair hand-written per panel.
- `components/account/controls.tsx` — a kit: `SettingGroup`, `SettingRow`,
  `ChoiceChips`, `SettingSwitch`, `Toggle`. Appearance, alerts, playback and
  profile all render through it now.
- `components/account/subtitle-select.tsx` — the 51-language chip wall became a
  Popover + cmdk combobox. Each row carries an English `search` string, so
  typing `arab` finds العربية.
- `lib/subtitle-languages.ts` — that table moved out of the panel so the account
  page and the in-player panel read one list.
- `components/player/player-settings.tsx` — a gear in the overlay bar over the
  frame: subtitles, subtitle size, progress bar, and (series only) play the next
  episode, plus a link to the full panel. Changing a boot-time setting remounts
  the frame through a new `playerBoot` token in the hero, so it takes effect on
  the title you are watching rather than the next one.
- Auto-next is real now: `ReelyPlayer` forwards its `ended` message, and the
  series hero starts `episode + 1` when the season has one.

## Mistakes

**Chased the wrong border first.** The report was "some cards has weird
border". I went to the poster rails, read computed styles, zoomed the pixels —
and they were clean (`ring-1 ring-transparent`, one shadow). Nearly filed a
false bug. The actual complaint was the settings panels, where three different
raised-surface recipes and two duplicate chip components with different radii
sat on one screen: the switch rows read as stray boxes because they were stray
boxes. Look at the screen the person was on, not the component the words
sound like.

**`prefs.autoNext` was a pref nobody read.** The API accepted it, the type had
it, and no code path anywhere consumed it — no UI to set it, no reader to act
on it. It had been shipped as a field and left as one. A pref that nothing
reads is not a feature waiting to be finished, it is a lie in the schema.

**Shipped the in-player panel over embeds.** The first version gated only on
`pro`, so a supporter watching on Server 2 got a panel whose every lever —
subtitles, size, mini bar, auto-next — is read by the Reely Player and by
nothing else. Caught in the browser, not by the typechecker: it is gated on
`useReely` now, the same flag that decides which frame renders.

**Verified against a dead DOM for four rounds.** Local checking needed a
supporter, so the account store was seeded at module scope — which is a
hydration mismatch, and the recovery render is what made the page look broken.
Worse, the measurements that "proved" it broken were wrong: `document
.querySelectorAll('button')` from the top of `body` returns Next's `<div
hidden>` streaming copy first, so every rect was 0×0 and every click landed on
nothing. The harness screenshot was blank while the real tree was 4142px tall.
Query inside the visible root (`body > div.min-h-svh`), and seed test state
after mount, not at module init.

## What worked

- One `surface` token plus `SettingGroup`/`SettingRow` fixed every panel at
  once, which is what "fix it in the shared place" is supposed to buy.
- The in-player panel reuses the account panel's components verbatim — same
  storage, same controls, two mount points. No second styling to keep in step.
- `onEnded` held in a ref inside `ReelyPlayer` so the message listener is not
  torn down and rebuilt on every parent render; rebuilding it mid-playback
  drops messages.

## Rules

- A setting that boots with the player needs a remount to take effect. Give the
  frame a boot token; do not tell people to reload.
- Gate a settings panel on the surface that reads the settings, not on who is
  allowed to see it.
- Do not add a pref field without a reader. The reader is the feature.
- In a Next dev browser session, scope every DOM query to the visible root —
  `body` still holds the streaming `<div hidden>` copy, and it answers first.
