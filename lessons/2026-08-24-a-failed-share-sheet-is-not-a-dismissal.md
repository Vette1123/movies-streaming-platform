# A failed share sheet is not a dismissal

Date: 2026-08-24
Area: `hooks/use-share.ts` (used by `/reels` and `/match-night`)

## What

`navigator.share()` rejects for two very different reasons, and the hook treated
them as one. `AbortError` means the user opened the sheet and said no. Every
other rejection — `NotSupportedError`, `NotAllowedError` for a call outside a
transient activation, a locked-down webview — means the sheet never opened at
all. The catch returned early on both, so on any platform in the second group
the Share button did nothing and said nothing: no sheet, no copy, no toast.

Now only `AbortError` is treated as the user's decision; everything else falls
through to the clipboard + toast that was already written for browsers with no
`navigator.share` at all.

## Mistakes

**The comment described the behaviour the code did not have.** It said "fall
through to copy only when the API itself was missing" sitting directly above a
`return false` that fell through to nothing. The comment was right about the
intent and wrong about the code, and it read as correct for as long as nobody
executed the branch.

**Feature-detection was mistaken for capability.** `typeof navigator.share ===
'function'` was treated as "this platform can share". It is not: desktop Chrome
exposes it and rejects, and any browser rejects a call the user gesture did not
reach. The only proof a share sheet works is a resolved promise.

**The first browser check "passed" while proving nothing.** The tap produced no
toast, which looked like the native path succeeding — the real
`navigator.share` was still installed, because `Page.addScriptToEvaluateOnNewDocument`
had been sent to the target that existed _before_ `new_tab()` created a new one.
The stub has to be installed in the live page (or the boot script re-sent after
the tab exists), and the check is only meaningful once you can see the stub was
in place.

## What worked

Driving both branches explicitly: stub `navigator.share` to throw
`NotSupportedError` (expect clipboard + "Link copied"), then to throw
`AbortError` (expect nothing at all). Two clicks, both outcomes observed.

## Rules

- Rejections carry a name. Branch on it before deciding a failure was a choice.
- Feature detection tells you an API exists, not that it works. A capability is
  proven by a resolved promise.
- When a comment and the code below it disagree, one of them is a bug — and it
  is usually not the comment.
