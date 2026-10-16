# Every server gets your settings

## What

"Make sure saved subtitles, quality, everything is persisted, across any
server." The Reely Player half lives in the player repo's lesson
(`reely-pro-player/lessons/2026-10-16-the-volume-slider-was-clipped.md`):
mute, audio language, the full-screen bar switch, and a volume slider that was
clipped away. This half is the site and the embeds.

- **`PlaybackPrefs.audio`** joins sub, subSize, quality and miniBar.
  `prefsFromPlayer` takes `audio` and `miniBar` from the player, the Worker
  ticket carries `al`, and `cleanPrefs` now keeps an explicit `miniBar: false`
  (it was dropped, so "off" never reached the account and every device's old
  "on" won).
- **Embeds take what their own docs offer**, through tokens in the slot's
  `_QUERY` secret, latched per frame (`hooks/use-frame-tokens.ts`):

  | Server                | Query                           | Gets                                |
  | --------------------- | ------------------------------- | ----------------------------------- |
  | 1 vidsrc.sh           | `startAt={start}&ds_lang={sub}` | resume + subtitle language          |
  | 3 vidlink             | `startAt={start}`               | resume (no subtitle-language param) |
  | 5 vidfast             | `startAt={start}&sub={sub}`     | resume + subtitle language          |
  | 2 vidsrc.to, 4 2embed | —                               | nothing documented                  |

  No embed documents a quality or audio parameter, so those stay in each
  provider's own storage, per device.

- **Server 1 reported progress and nobody heard it.** It posts
  `player_status` / `player_progress` / `player_duration` (its docs), and
  `parseEmbedProgress` only knew `event: 'timeupdate'` / `currentTime`. So
  nothing watched on Server 1 was saved for resume, and nothing it finished was
  ticked off. Both shapes parse now, in either nesting.

## Mistakes

- **Server 1's progress had been silently dropped since it was added.** The
  bridge's contract was written against one provider family and never checked
  against the others' docs. An integration that "accepts any provider" by
  recognising one shape is an integration with one provider.
- **No wrong turn on the tokens.** `{start}` from the round before generalised
  in place; the latch kept the iframe still under eight position writes on the
  real page.

## What worked

- Reading every provider's own docs (one was a SPA: grep its bundle for the
  docs table) before writing a line, then a table of what each one actually
  takes. Two of five take nothing, and saying so beats guessing parameters.
- Checking which provider sits in which slot IN THE PRODUCTION BUNDLE before
  setting each secret, since a slot's query is meaningless on the wrong host.

## Rules

- A per-provider capability goes in that slot's env, never in code, and only
  from the provider's docs.
- When a bridge parses third-party events, test every provider's documented
  shape, not the one that was in front of you.
- An explicit "off" is a value. Dropping it lets an older "on" somewhere else
  win.
