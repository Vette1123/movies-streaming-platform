# Pro by email after the payment provider was suspended

## What

The old payment provider suspended the account on 2026-11-06. Every buy button
now opens `proMailto()` (`config/support.ts`) addressed to `PRO_EMAIL`, with the
plan in the subject and the sign-in address in the body. The owner replies with
how to pay and runs `pnpm pro <address>`. The webhook, its HMAC verifier, the
floating widget and its CSS, the checkout watcher, the probe, the WAF and
apex-redirect exemptions and the Worker secret are all deleted.
`claimSupporterGrants` moved to `lib/billing/supporters.ts`, so existing
supporters keep Pro.

## Mistakes

- A shell heredoc and a temp-file edit were refused by the worktree guard, and
  the follow-up `cat` overwrote `config/support.ts` with only its tail. Restored
  from git. In a worktree session, use the Edit tool for multi-line changes and
  keep git commands on their own line.
- A subagent started after `EnterWorktree` inherited the pin and could not run a
  shell in the sibling repo. Do the cross-repo work before entering, or after
  `ExitWorktree`.
- The guard test was first named after the provider, so it flagged its own name
  in CLAUDE.md.
- Turbopack 500s in a worktree whose `node_modules` is a symlink to main (outside
  its workspace root). `next dev --webpack` works.

## What worked

Entitlement was already provider-neutral (a `pro` grant plus a `supporters` row
by email), so swapping the provider meant deleting code, not migrating data.

## Rules

- A payment provider is only ever named in `config/support.ts`.
  `tests/pro-by-email.test.ts` fails if the old one shows up anywhere live.
- Applied migrations and lessons are history; they keep the old name.
