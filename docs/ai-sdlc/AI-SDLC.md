# AI-SDLC: the Interlace baseline

How every repository under `ofri-peretz` builds software with Claude. This file is the
source of truth. Copies elsewhere point here. Interlace follows
[Anthropic's engineering practice](https://www.anthropic.com/engineering), and every practice
below links to the result Anthropic measured for it in [EVIDENCE.md](EVIDENCE.md).

Two scripts keep this page honest: the **audit** says which repos meet the baseline, and the
**scorecard** says what Claude costs and what it ships. The latest numbers are in
[BASELINE-2026-11-25.md](BASELINE-2026-11-25.md).

```bash
npm run ai-sdlc:audit   # each repo against this page, read from GitHub's default branch
npm run ai-sdlc:score   # tokens, cache hit, start context, merged PRs, last 28 days
```

## The four rules

1. **Hand off through a file.** A decision that lives only in a chat log cannot be reviewed,
   diffed or replayed by the next agent. ([E-15](EVIDENCE.md#e-15))
2. **Give Claude a check before you start.** One command that exits non-zero on failure.
   Never edit a test to make it pass. ([E-11](EVIDENCE.md#e-11), [E-25](EVIDENCE.md#e-25))
3. **Someone other than the author accepts at Design→Build and at Deploy.** The agent that wrote
   the code does not approve it. ([E-8](EVIDENCE.md#e-8), [E-9](EVIDENCE.md#e-9)) Until
   2026-11-26 that was always a human. Since then the owner delegates both points to the hourly
   AI-SDLC loop ("without me in the loop"). The `review` check, a Claude reviewer with a fresh
   context that did not write the change, plus every required gate, stand in for acceptance;
   the owner reviews what merged afterwards. Release PRs (`chore(release)`, which publish to npm)
   are not delegated.
4. **A fix is done when a check would have caught it.** Prove the check fails on the unfixed
   state.

## Context comes first

Every stage runs inside a context window, so context is a budget. Anthropic: keep the
context to "the smallest set of high-signal tokens" ([E-20](EVIDENCE.md#e-20)). Deferring
tool definitions cut one example from 77K to 8.7K tokens ([E-16](EVIDENCE.md#e-16)). The
multi-agent research system found token use alone explains 80% of the variance in results
([E-26](EVIDENCE.md#e-26)).

A repo's context is **ready** when the audit shows all of these:

| Check                                                               | Why                                                                                                                                                 |
| :------------------------------------------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CLAUDE.md` exists, and with its `@imports` it is at most 200 lines | Anthropic's limit for CLAUDE.md ([E-25](EVIDENCE.md#e-25)). Everything else goes in skills, loaded on demand                                        |
| `AGENTS.md` exists                                                  | The cross-tool map of the repo. `CLAUDE.md` holds only the Claude-specific contract                                                                 |
| codegraph is in `.mcp.json` and `.codegraph/` is gitignored         | One indexed lookup instead of a grep-and-read loop. Its maintainers report 62% fewer tokens and 88% fewer tool calls, not yet measured on our repos |
| `REVIEW.md` and `.sdlc/checklist.yaml` exist                        | What the reviewer checks, so a review reads one brief instead of the whole repo                                                                     |

**Claude review runs in a repo only once its context is ready.** `audit --check` fails
when a repo has the review on before its context is ready, and the weekly
`ai-sdlc-audit` workflow files an issue when it does.

## The six stages

Each stage hands off through one committed Markdown file. Stage 6 writes back a Stage 1
`intent.md`, so the stages form a loop.

| Stage      | Artifact                                    | Anthropic practice                                                                                                                                       | Audit check                                                       |
| :--------- | :------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------- |
| 1 Plan     | `intent.md` in `.sdlc/intents/<slug>/`      | Start with the simplest design, add complexity when measured ([E-27](EVIDENCE.md#e-27))                                                                  | intents                                                           |
| 2 Design   | `spec.md` beside the intent, human-accepted | Evaluate on real tasks first, then build skills to close the gaps ([E-19](EVIDENCE.md#e-19))                                                             | intents (the burgee lock refuses an approved intent with no spec) |
| 3 Build    | plan → PR, from a worktree                  | Parallel subagents with their own context windows ([E-26](EVIDENCE.md#e-26)); progress log + commits so a new session resumes ([E-15](EVIDENCE.md#e-15)) | context ready, codegraph                                          |
| 4 Test     | one command, plus evals                     | Quality tests are the verifier, keep their output short ([E-11](EVIDENCE.md#e-11)); start evals from 20–50 real failures ([E-14](EVIDENCE.md#e-14))      | feedback loop, lefthook, evals                                    |
| 5 Deploy   | merged PR                                   | A separate, skeptical evaluator ([E-9](EVIDENCE.md#e-9)); hooks gate actions ([E-8](EVIDENCE.md#e-8))                                                    | REVIEW.md, checklist, Claude review                               |
| 6 Maintain | breach → new `intent.md`                    | Run quality evals continuously and tie each change to its metrics ([E-21](EVIDENCE.md#e-21))                                                             | control bands                                                     |

Stage detail (templates, the Jev and Quint gates, σ bands): `burgee/.sdlc/` is the reference
implementation, and `eslint/scripts/control-bands.ts` is the reference watcher.

## What we use ourselves

We use our own tools. Each one also cuts tokens or saves time.

| Tool                   | Role                                                                                                                                           | Where                                              |
| :--------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------- |
| **subagent-gateway**   | Searches, logs, test runs, docs and diffs go to read-only Haiku workers. Only their summary enters the main context ([E-20](EVIDENCE.md#e-20)) | user-scope plugin, every repo                      |
| **burgee**             | `triggerlist` drives the Claude review from `REVIEW.md` + `checklist.yaml`; `hookset` supplies the hooks; the intent lock guards Stages 1–2    | review action, hooks, `.sdlc/`                     |
| **our ESLint plugins** | Every repo lints with them, on their latest major                                                                                              | audit: our eslint plugins, plugins on latest major |
| **codegraph**          | Indexed symbol graph over MCP                                                                                                                  | `.mcp.json` + local `.codegraph/` index            |
| **headroom**           | Compresses tool output before it reaches the model; originals stay retrievable                                                                 | user-scope MCP                                     |
| **rtk**                | Shell output filter, applied by a PreToolUse hook                                                                                              | user-scope hook                                    |

Prompt caching needs a stable prefix: CLAUDE.md, the tool set and MCP servers. Change them
on purpose, not per session ([E-28](EVIDENCE.md#e-28)).

## Measure how Claude is doing

The scorecard reads local Claude Code session logs (nothing leaves the machine) and merged PRs
from GitHub, per repo:

| Metric                       | Direction | What it tells us                                                                                         |
| :--------------------------- | :-------- | :------------------------------------------------------------------------------------------------------- |
| **median start context**     | ↓         | Tokens spent before any work: CLAUDE.md chain, tool and MCP definitions. The context-optimization metric |
| **cache hit**                | ↑         | Share of input tokens served from the prompt cache                                                       |
| **input tokens / merged PR** | ↓         | What one shipped change costs. The efficiency metric                                                     |
| **merged PRs**               | ↑         | Velocity                                                                                                 |
| **subagent share of output** | —         | How much work subagents do, not the main thread                                                          |

Review quality is measured apart from cost: `eslint/scripts/review-hit-rate.ts` scores how many
review findings led to a change.

Each change to context or tooling (a CLAUDE.md edit, codegraph in a new repo, a new MCP server)
is judged by these numbers against [the baseline](BASELINE-2026-11-25.md), not by how it felt.

## Turning on Claude review in a repo

1. The audit shows the repo's context is ready.
2. Copy `.github/workflows/claude-code-review.yml` from this repo.
3. Set the secret. The token draws on the subscription's programmatic credit. Run
   `claude setup-token` once, then `gh secret set CLAUDE_CODE_OAUTH_TOKEN -R ofri-peretz/<repo>`.
4. Install the [Claude GitHub App](https://github.com/apps/claude) on the repo.
