@AGENTS.md

# Commands

- `npm run ci:local` mirrors the entire pre-push gate (`lefthook run pre-push --all-files`); it is
  the only check that matches CI exactly.

# Gotchas

- This repo dogfoods its own ESLint plugins alongside oxlint via turbo `--affected`. A lint
  failure here can mean the rule changed, not that the code is wrong: check which linter spoke.
