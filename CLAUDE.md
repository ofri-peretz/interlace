# Commands

- `npm run ci:local` — runs the full pre-push gate (`typecheck` + `test` + `build` via turbo).
  Run this before pushing. **Lint is not included**: `lint:oxlint` and `lint:eslint` are a
  separate CI job, so run `npm run lint` independently.
- `npm test` / `npm run lint` / `npm run typecheck` — all turbo-scoped across the workspace.

# Workflow

- Branch `<type>/<slug>`. Commit `<type>(<scope>): <subject>` — commitlint enforces the scope.
- `git commit` is fast (only commitlint runs on the message). **`git push` is the slow one** —
  it runs the `pre-push` suite (typecheck + test + build) and can take **3–4 minutes**. That is
  not a hang. If a push is killed mid-flight, check `git log origin/<branch> -1` before retrying;
  a timed-out push may still have landed.
- IMPORTANT: never `--no-verify`. The hooks are the gate.
- Waiting on CI? `gh pr checks <PR> --watch`. Never hand-roll `until … gh pr view … sleep` —
  those loops get killed by the harness timeout and end knowing nothing.

# Gotchas

- This repo dogfoods its own ESLint plugins alongside oxlint via turbo `--affected`. A lint
  failure here can mean the rule changed, not that the code is wrong — check which linter spoke.
