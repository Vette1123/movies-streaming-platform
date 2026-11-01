# Skip intro

## What

The `autoSkip` option joined the closed list, the account panel and the ticket (`as`). The player's `skip` reports become `feature_used {feature: 'skip_intro', action, segment}`, checked by `skipReportFrom`. The timing data and the button live in the player repo: its lesson `2026-11-01-skip-intro-from-two-databases.md`.

## Mistakes

- I said skip intro was impossible for want of data, without looking. IntroDB and TheIntroDB both answer anonymously.
- The first version of `skipReportFrom` took a narrow object type, which the message type shares no field with. `Record<string, unknown>`, as `prefsFromPlayer` takes, was already the pattern next door.
- The new route test called `normalisePrefs` with the bare prefs. Its input is `{ playback }`.

## What worked

- The closed list from the previous change: one file, and the panel, prefs, route and ticket all carried the new field. Adding it took a few lines.

## Rules

- The account panel row reuses `SettingSwitch` and was not opened in a browser this time; the field is proven by tests and the player's switch by the harness.
