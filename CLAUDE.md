# Commands

- `npm run ci:local` — mirrors the entire pre-push gate (`lefthook run pre-push --all-files`).
  Run this instead of the individual steps; it is the only check that matches CI exactly.
- `npm test` / `npm run lint` / `npm run typecheck` — all turbo-scoped across the workspace.

# Workflow

- Branch `<type>/<slug>`. Commit `<type>(<scope>): <subject>` — commitlint enforces the scope.
- `git commit` and `git push` run lefthook and can take **3–4 minutes**. That is not a hang.
  If one is killed mid-flight, check `git log origin/<branch> -1` before retrying — a timed-out
  push may still have landed.
- IMPORTANT: never `--no-verify`. The hooks are the gate.
- Waiting on CI? Use `pr-blockers watch`. Never hand-roll `until … gh pr view … sleep` —
  those loops get killed by the harness timeout and end knowing nothing.

# Gotchas

- This repo dogfoods its own ESLint plugins alongside oxlint via turbo `--affected`. A lint
  failure here can mean the rule changed, not that the code is wrong — check which linter spoke.
