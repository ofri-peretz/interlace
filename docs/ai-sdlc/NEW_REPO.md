# Setting up a new Interlace repo

Every Interlace OSS repo runs the same verification loop: the same git hooks, the same Claude Code
hooks, the same AI reviewer and the same branch rules. This page is that setup in order. Each step
ends with the command that proves it is done. A step without a passing proof is not done.

Reference repos: `subagent-gateway` is the smallest complete example; `eslint` and `burgee` are the
largest. When a step below says "copy", copy from `subagent-gateway` at `main`.

## 0. Before you create it

- It is a **package, not a service**, with zero external runtime dependencies, and a family of its
  own (one repo per family). Those are the ecosystem principles in `PRINCIPLES.md` at the root of
  the workspace above the repos; read it before making the repo.
- Make it **public**. Private repos on a free account can have neither rulesets nor branch
  protection, and CodeRabbit's free tier is for public repos only.

## 1. Create the repo and its merge settings

```bash
gh repo create ofri-peretz/<name> --public --clone
gh repo edit ofri-peretz/<name> --enable-auto-merge --delete-branch-on-merge \
  --enable-squash-merge --enable-merge-commit=false
```

Agents merge their own PRs with `gh pr merge --auto --squash` once checks are green, so auto-merge
must be on.

Proof: `gh api repos/ofri-peretz/<name> --jq '.allow_auto_merge, .delete_branch_on_merge'` prints
`true` twice.

## 2. Node, commit messages and git hooks

1. `.nvmrc` with `24`, and `"engines": { "node": ">=22.13" }` in `package.json`. triggerlist needs
   Node 22.13 or later.
2. `commitlint.config.mjs`: copy it. Scopes are the workspace packages plus `ci`, `deps`, `docs`
   and `workspace`.
3. Git hooks from hookset, pinned to the current release (`npm view hookset version`):

   ```bash
   npx hookset@<version> init --claude
   ```

   This writes `lefthook.yml`, which pulls hookset's pre-commit, commit-msg and pre-push presets
   from burgee at `hookset@<version>`. It also vendors the Claude Code hook pack, described in
   step 3. Every commit must then carry `Verified-by: <command> -> exit 0`, or
   `Verified-by: none (<why>)`, under 100 characters. The provedone station enforces it.

Proof: `npx hookset check` exits 0, and `git commit` on a message without `Verified-by:` is refused.

## 3. Claude Code: hooks, CodeGraph and the context budget

After `hookset init --claude`, `.claude/` holds:

| File                           | What it does                                                                              |
| ------------------------------ | ----------------------------------------------------------------------------------------- |
| `hooks/guard-bash.mjs`         | Denies hook bypass (`--no-verify`, `LEFTHOOK=0`), CI poll loops and edits to frozen paths |
| `hooks/stop-after-3.mjs`       | Ends the turn after three failed test runs in a row                                       |
| `hooks/verify-before-stop.mjs` | Sends a turn back when uncommitted code has no passing test run                           |
| `hooks/codegraph.mjs`          | Builds the CodeGraph index in the background at session start                             |
| `settings.json`                | Wires the hooks above (PreToolUse, PostToolUse, PostToolUseFailure, Stop, SessionStart)   |
| `hookset.json`                 | `context.tokens`: the ceiling on what Claude loads into every session                     |

Add by hand, copying from `subagent-gateway`:

- `.mcp.json` with the `codegraph` server at the pinned version, `.codegraph/` in `.gitignore`, and
  in `settings.json` `"enabledMcpjsonServers": ["codegraph"]` and
  `"permissions": { "allow": ["mcp__codegraph__codegraph_explore"], "deny": ["Read(./.env)", "Read(./**/.env)"] }`.
- `verifyIgnore` globs in `hookset.json` for files that no agent edits (synced data, generated
  reports), so the Stop hook never loops on them.
- A short `CLAUDE.md` that points at `AGENTS.md`. `AGENTS.md` holds the commands: the one
  `ci:local` command that mirrors pre-push, and the affected-tests command. Anything a machine can
  check belongs in a hook or gate, not in prose.

Proof: `node .claude/hooks/codegraph.mjs --self-test`,
`node .claude/hooks/verify-before-stop.mjs --self-test` and `npx hookset context` all exit 0.

## 4. CI: the shared gates

Copy these workflows. They call burgee's reusable workflows, so a fix lands once for every repo.

| Workflow                     | What it runs                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------- |
| `hooks.yml`                  | `hookset / hookset check` and `hookset / provedone receipts` (the "Shared gates")           |
| `claude-code-review.yml`     | The `review` check: burgee's `triggerlist-review` action briefs Claude from the base branch |
| `verification-scorecard.yml` | Weekly replz scorecard, held to the bands in `.sdlc/bands/verification-scorecard.json`      |
| `check.yml` or `ci.yml`      | The repo's own build, typecheck and tests                                                   |

Proof: open a trivial PR and see `hookset / hookset check`, `hookset / provedone receipts`,
`review` and the repo's own checks all report.

## 5. The AI reviewer

1. Add `CLAUDE_CODE_OAUTH_TOKEN`. Create it with `claude setup-token`; it lasts one year. Then run
   `gh secret set CLAUDE_CODE_OAUTH_TOKEN -R ofri-peretz/<name>` in a real terminal, because the
   prompt hides the pasted value. Without it, the review job passes without reviewing anything.
2. Add `REVIEW.md` and `.sdlc/checklist.yaml`. The checklist holds the questions a reviewer must
   answer, each fired by a path or pattern trigger and pointing at the check that answers it.
   `npx triggerlist compile` writes `REVIEW.md` from it.
3. Choose the reviewer by volume. Claude reviews the high-volume repos. CodeRabbit reviews
   low-volume public repos, where its free quota lasts: install the CodeRabbit GitHub App on the
   repo and copy `.coderabbit.yaml` from `serverless`. The split and its measurements are in
   eslint's [`docs/review-hit-rate/README.md`](https://github.com/ofri-peretz/eslint/blob/main/docs/review-hit-rate/README.md).

Proof: the trivial PR from step 4 gets a `claude[bot]` (or `coderabbitai[bot]`) review comment, not
only a green check.

## 6. Branch rules, as code

Rulesets are declared in burgee and applied by its `rulesets` workflow. Do not set them by hand,
because the next apply replaces a hand-made change.

1. In burgee, add `.github/rulesets/protect-main-<name>.json`. Copy
   `protect-main-subagent-gateway.json`: no deletion or force-push, linear history, PR required with
   0 approvals and `required_review_thread_resolution: true`, plus required status checks. List
   only checks that reported success on the repo's recent merged PRs, so a check that never runs
   cannot stall a merge.
2. Add the repo to `require-provedone-receipts.json`.
3. `node scripts/apply-rulesets.mts --dry-run` in burgee must list both rulesets for the new repo.

Proof: `gh api repos/ofri-peretz/<name>/rules/branches/main` lists `pull_request` with
`required_review_thread_resolution: true` and `required_status_checks`.

## 7. The AI-SDLC stages

The six stages and their artifacts are in [AI-SDLC.md](./AI-SDLC.md) and [STAGES.md](./STAGES.md):
an intent in `docs/intents/` before work starts, a spec a human accepts before build, locks that
fail when a fix is reverted, and control bands that open a new intent when breached.

Proof, from this repo:

```bash
npm run ai-sdlc:audit   # which stages each repo meets, read from its default branch
npm run ai-sdlc:score   # context and token cost per repo
```

The new repo appears in both, with no stage missing that the reference repos have.

## Checklist

- [ ] Public; auto-merge and delete-branch-on-merge on
- [ ] `.nvmrc`, `commitlint.config.mjs`, `lefthook.yml` from `hookset init`; `npx hookset check` passes
- [ ] `.claude/` hook pack and self-tests pass; `.mcp.json` CodeGraph; `.env` reads denied
- [ ] `CLAUDE.md` → `AGENTS.md` with the `ci:local` command; `hookset context` under its ceiling
- [ ] `hooks.yml`, `claude-code-review.yml`, `verification-scorecard.yml`, the repo's own CI
- [ ] `CLAUDE_CODE_OAUTH_TOKEN` set, or CodeRabbit installed and `.coderabbit.yaml` added
- [ ] `REVIEW.md` compiled from `.sdlc/checklist.yaml`
- [ ] `protect-main-<name>.json` and the receipts ruleset in burgee, applied
- [ ] Listed by `npm run ai-sdlc:audit`
