# The store list was Play by construction

## What

`lib/apps.ts` promotes Rafiq, Masareef and Nafis from the header popover, the mobile
drawer, the footer and the command menu. It gave every app exactly one URL field,
`playStoreUrl`, built from the Android package, and one helper, `openOnPlayStore`. Rafiq
and Masareef shipped on the App Store on 4 Sep, so from that day an iPhone reader tapping
either name in any of those four places landed on a Google Play listing they could not
install from.

Apps on both stores now carry `appStoreUrl` and `installUrl`. Android keeps the
`market://` hand-off, an iPhone gets the App Store, and a desktop reader gets the chooser
page — from a laptop there is no way to know which phone they will install on. The Play
triangle became a neutral phone glyph.

## Mistakes

**I nearly wrote a platform claim that was false for one app in three.** Replacing the
footer's "on Google Play." with "for Android and iPhone." felt like the whole fix, and it
was wrong the moment the sentence still listed Nafis, which is Android-only. Any clause
covering a list is only as true as its weakest member. The sentence lost the platform
claim entirely instead of gaining a bigger one.

**I appended the store label to the header popover subtitle without looking at the box it
renders in.** `PopoverRow`'s subtitle does not truncate and the popover is `w-72`; Rafiq's
tagline already wrapped to two lines there, so "· App Store · Google Play" would have made
it three. Backed it out — the heading says "Our apps" and the glyph is neutral, so nothing
in that popover claims Play any more and the label buys nothing.

**`git add -A` committed an embedded worktree as a gitlink.** `.claude/worktrees/` was not
ignored, so the commit carried a one-line submodule pointer to a checkout no clone can
resolve. Caught it in `git show --stat` after the fact. Amended, and the path is ignored
now.

**Two dead ends before I looked in the right place.** Apple's developer page kept erroring
and the iTunes search API timed out, both while I was trying to establish whether Nafis
has an iOS build. The answer was sitting in the repo the whole time: no `ios` block in
`eas.json`'s submit config and no `apps.apple.com` string anywhere in it.

## What worked

**Asking the repo, not the vendor.** "Is this app on the App Store" is answered by its own
`eas.json` and a grep for `apps.apple.com`, in one command, offline. `curl`ing the three
`/go` pages settled the chooser question the same way — Masareef and Rafiq return 200,
Nafis 404s, which is the same fact from a second direction.

**Writing the reason for the odd one out next to the odd one out.** Nafis keeps a bare
Play URL. Without a comment saying why, that reads as the exact bug this commit fixed, and
the next person "fixes" it into a chooser that 404s.

**Letting the icon audit fall out of the label change.** Changing the row's hint to "App
Store · Google Play" is what made the Play triangle beside it obviously wrong. A label and
its icon are one claim.

## Rules

- **A single-store URL field is the bug, not the value in it.** If the shape of the data
  cannot express a second store, no amount of updating individual entries will fix it.
- **A platform claim over a list is only as true as its weakest member.** Drop the clause
  rather than widen it.
- **Check the container before adding text to a row.** Whether a subtitle truncates and how
  wide its parent is decides whether one more phrase is information or a third line.
- **Verify an app's store presence from its own repo.** `eas.json` submit config and a grep
  for the store host beat any store page that is having a bad day.
- **`git add -A` in a repo with agent worktrees stages a gitlink.** Ignore
  `.claude/worktrees/`, and read `git show --stat` before pushing.
