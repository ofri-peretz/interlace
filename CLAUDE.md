# Commands

- `npm run ci:local` mirrors the entire pre-push gate (`lefthook run pre-push --all-files`); it is
  the only check that matches CI exactly. `git commit` and `git push` run lefthook and can take
  3–4 minutes: not a hang. Wait on CI with `pr-blockers watch`.
- Commit scope (commitlint), skipped hooks and CI polling loops (`.claude/hooks/guard-bash.mjs`)
  are checks whose messages name the fix.

# Gotchas

- This repo dogfoods its own ESLint plugins alongside oxlint via turbo `--affected`. A lint
  failure here can mean the rule changed, not that the code is wrong: check which linter spoke.
