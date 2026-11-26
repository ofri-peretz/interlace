@AGENTS.md

# Commands

- `npm run ci:local` (`lefthook run pre-push --all-files`) is the only check that matches CI
  exactly.

# Gotchas

- Lint runs our own ESLint plugins beside oxlint (turbo `--affected`): a failure can mean the rule
  changed, not the code. Check which linter spoke.
