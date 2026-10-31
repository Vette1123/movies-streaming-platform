# Kodi guide made reachable, supporter benefits regrouped

## What

`/kodi` existed with no inbound link. It is now linked from the footer, `/support`,
the supporter panel, the account page and `/link`, and rebuilt as a full page.
Benefits are grouped, the TV has its own band, and "Ask for any feature and I will
build it" sits on both the pitch and the supporter panel.

## Mistakes

- Yesterday's add-on shipped a page nothing pointed at, and "the page returns 200"
  read as finished. The perk text even named `/link` as where the add-on lives, which
  only a signed-in supporter could see.
- The first browser check hit port 3000, another session's server, and showed the old
  page. Next had moved this worktree to 3001 and said so in a line nobody read.
- The first version of the reachability test only matched single quotes, so it failed
  on JSX `href="/kodi"`.

## What worked

- Driving the page found the squeezed flagship strip, which reading the code had not.
- Forcing the signed-in panel with a throwaway line, then reverting it, is the quick way
  to see a supporter-only view without an account.

## Rules

- A new page is not done until something links to it. Check inbound links, not status.
- Read the dev server's port line before trusting a screenshot.
- Benefits live in `config/support-features.ts`; the pitch and the panel both read it.
