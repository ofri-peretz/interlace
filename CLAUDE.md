@AGENTS.md

# Commands

- `npm run ci:local` mirrors the entire pre-push gate (`lefthook run pre-push --all-files`); it is
  the only check that matches CI exactly. Wait on CI with `pr-blockers watch`. One-off checks:
  `npm test`, `npm run lint`, `npm run typecheck`.
- Commit scope (commitlint), skipped hooks, CI polling loops and a foreground `git commit` or
  `git push` on a short timeout (`.claude/hooks/guard-bash.mjs`) are checks whose messages name
  the fix.

# Gotchas

- This repo dogfoods its own ESLint plugins alongside oxlint via turbo `--affected`. A lint
  failure here can mean the rule changed, not that the code is wrong: check which linter spoke.
