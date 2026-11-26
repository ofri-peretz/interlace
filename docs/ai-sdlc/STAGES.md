# The six stages in detail

The stage-by-stage reference behind [AI-SDLC.md](AI-SDLC.md), which is the baseline every
`ofri-peretz` repo follows. Which repo meets which stage today is the audit's job
(`npm run ai-sdlc:audit`), not this page's. The "where we are" notes below are history.

Adapted from Anthropic's [AI-Native SDLC
Playbook](https://academy.claude.com/courses/ai-native-sdlc-playbook). The six
stages, the artifact names (`intent.md`, `spec.md`) and the control-band mechanism
are theirs; the "where we are" rows are this org's actual state as of 2026-08-30.

---

## The shape of it

Six stages, each producing **one version-controlled, human-readable,
machine-executable Markdown artifact**. Accepting an artifact is what starts the next
stage. It is a loop, not a line: Stage 6 writes its findings back as a Stage 1
`intent.md`.

```
  ┌──────────────────────────────────────────────────────────────┐
  │                                                              │
  ▼                                                              │
1 Plan  ─→  2 Design  ─→  3 Build  ─→  4 Test  ─→  5 Deploy  ─→  6 Maintain
intent.md    spec.md     plan/PR      evals       merge          breach
             + human     + CLAUDE.md  + loops     + hooks       → new intent.md
               accept                             + human accept
```

Two rules hold the whole thing up:

- **Every stage hands off through a file, not a conversation.** A decision that lives
  only in a chat log cannot be reviewed, diffed, or replayed by the next agent.
- **A human accepts at Design→Build and at Deploy.** The agent that wrote the code
  has no way to approve it. That separation is the point.

---

## Stage 1 — Plan: capture as `intent.md`

A short version-controlled file stating **what is wanted, why, and under which
constraints**. The originator drafts it with Claude; a product owner reviews before
it is committed.

Lives in `.sdlc/intents/` in the relevant repo.

```markdown
# Intent: <short title>
Author: <name>. Status: draft | review | approved.

## Problem
What is happening now, and what it costs.

## Proposed outcome
What is true after this lands.

## Affected users and systems
Who and what this touches.

## Constraints
What must not change. Policies, budgets, compatibility.

## Open questions
What we do not know yet.
```

**Where we are:** ✅ `burgee/.sdlc/intents/` — 49 intents with a README, templates and a
lock (`scripts/intent-artifacts-lock.test.ts`) that pins the section shape and refuses an
`approved` intent with no `spec.md` beside it. `eslint/docs/intents/` holds eslint's. Other repos get the same folder when they need one.

---

## Stage 2 — Design: `spec.md`

Claude turns the intent into a requirements + design spec **in one working session**,
applying the skills that encode our standards:

> Read the attached intent.md and produce a requirements and design spec for
> integrating it into our existing codebase. Apply the skills available to you so the
> plan conforms to our brand guidelines, security policies and UX standards.

Commit `spec.md` **alongside** `intent.md`. The pair records what was asked for and
what was decided.

**The gate:** a human — the product owner, consulting a technical lead on anything
higher-risk — decides whether the pair progresses. Accepting the spec is what starts
plan mode in Stage 3.

**Where we are:** ✅ `.sdlc/intents/<slug>/spec.md`, from a template, enforced by the same
lock. The `*_PHILOSOPHY.md` documents and `.agent/rules/*` remain what they always
were — standing policy, applied *into* a spec rather than a substitute for one.

---

## Jev judges at Stage 1, Quint proves at Stage 2

Two tools attached to the two artifacts above. Full method, question set and conventions:
[`burgee/.sdlc/JEV-AND-QUINT.md`](https://github.com/ofri-peretz/burgee/blob/main/.sdlc/JEV-AND-QUINT.md).

- **[Jev](https://docs.typesafe.ai/introduction)** (TypeSafe's decision model) ranks the
  `intent.md` queue. It answers typed questions with a calibrated confidence: `Score`s for
  impact, `Noul`s for "is this ready for a spec" and "does this need a model". Code combines
  the scores by weight, and a human decides anything under the confidence threshold. Jev
  never moves an intent's status. The questions and thresholds live in one reviewed file per
  repo. With no `TYPESAFE_API_KEY` the run is `skipped`, never `failed`.
- **[Quint](https://quint-lang.org)** states a spec's state machine as a `.qnt` beside
  `spec.md`, with a `val safety`, and CI simulates it. It is required when Jev's `needs_model`
  fires: states, ordering, concurrency, retries, deadlines, exactly-once. Before a model merges
  it gets a mutation check, because a model that cannot fail is decoration. An undecided
  property is pinned as an *expected violation*, so a code change that answers it turns CI red.

| Repo | Jev | Quint |
| :-- | :-- | :-- |
| `burgee/` | intent triage over `.sdlc/intents/` | ✅ pilot: `closeout/registry.qnt`, `models.yml` |
| `eslint/` | false-positive issue triage (`false_positive.md`): real FP / config / duplicate / true positive; ranking `SECURITY-RULE-CANDIDATES.md` | the release and ratchet pipelines, not the rules: rules are per-file and stateless |
| `interlace/` | ranking `/interlace-audit` findings by user impact | the stateful philosophies: auth, pagination, deep-linking, forms |

**Where we are:** burgee only, as of 2026-10-11. eslint and interlace get it the first time
an intent there trips `needs_model`.

---

## Stage 3 — Build

| Practice | Where we are |
| :--- | :--- |
| **Plan mode as the default starting point** | ✅ used, ❌ output not committed as `plan.md` — Stage 3's artifact, which no repo writes yet |
| **`CLAUDE.md` as versioned institutional knowledge** | ✅ strong — root + per-repo, with a behavioural contract |
| **Skills as institutional knowledge** | ✅ strong — `.claude/skills/`, portable, versioned |
| **Parallel sessions and subagents** | ✅ heavy worktree use; ⚠️ well past the "two or three sessions" starting point, and the practical ceiling is *how many streams one person can review properly* |

A **parallel session** is a full Claude Code instance on its own task in its own
worktree. A **subagent** is a scoped helper inside one session, for jobs that recur.
Split work by file dependency, never by wishful thinking.

The **verifier subagent** is the standard pattern: one fresh-context check when work
is supposedly complete — *"Exercise the changed behavior and the two nearest
neighboring flows. Report what you ran, what you saw, and any behavior that does not
match plan."*

---

## Stage 4 — Test

### Give Claude a feedback loop

> Always give Claude a way to verify its own work, whether tests, a build, or a
> screenshot diff.

Wrap it in **one command that exits non-zero on failure** (`npm test`, `make test`).
A good loop has a quantifiable target and runs repeatedly *during* the work. A bad
loop is CI minutes later, review days later, production weeks later.

**Test files stay human-editable only while Claude is fixing code.** Otherwise the
loop closes by deleting the test.

**Where we are:** ✅ strong. `npm test`, per-package turbo tests, and the lock-test
discipline in `eslint/CLAUDE.md` ("if I revert the fix, would CI go red?").

### Continuous evals in CI

An eval suite that runs **whenever the agent's configuration changes** — a model
swap, a prompt rewrite, a skill edit. Collect 20–50 real tasks from recent work, each
with its accepted outcome, and check `tests pass, lint clean, behavior unchanged,
policy followed`.

Runs non-interactively, e.g.
`claude -p … --allowedTools 'Read,Edit,Bash(npm test)'`, on any change to
`CLAUDE.md`, skills, or hooks, plus a daily cron. **A skill change that drops the
pass rate gets reviewed before it merges**, and every production incident earns an
eval written by the team that owned it.

**Where we are:** ✅ `eslint/evals/`, two layers. Layer 1 is deterministic and free:
every relative link in each of 63 agent-facing documents must resolve — it found a
dead article pointer and six philosophy links left behind by the interlace repo split
on its first run. Layer 2 runs task cases against the live configuration and needs
`ANTHROPIC_API_KEY`; without one it reports `skipped`, never `failed`. `evals.yml`
fires on any change to `CLAUDE.md`, `AGENTS.md`, `.agent/**` or `lefthook.yml`, plus
weekly.

---

## Stage 5 — Deploy

### AI in the PR review loop

All PRs get an identical set of review passes, findings ranked by severity — bugs
(logic errors, broken edge cases, subtle regressions) and security (injection risks,
auth gaps, PII in logs).

> Findings do not approve or block a PR on their own, and branch protection still
> requires approval from a code owner.

The human judges *whether the change does what the plan intended and whether the risk
is acceptable*.

**Where we are:** ✅ `/code-review`, CodeRabbit, branch protection, CODEOWNERS.

### Hooks as approval gates

Hooks **allow**, **ask**, or **block** as the agent acts. Block returns the reason to
Claude. Ask pauses for a named person — which is what release gating needs. In
regulated setups these live in managed settings that engineers cannot override.

**Where we are:** ✅ lefthook pre-commit / pre-push / commit-msg for block, and
`.claude/hooks/release-gate.sh` for the ask: a production deploy, a direct
`vercel --prod`, or an `npm publish` pauses and quotes the command back to the human.
`RELEASE_APPROVAL=1` pre-approves a session. Pinned in both directions by
`release-gate-hook.test.ts` — the cases that must *not* fire matter more, since a gate
that cries wolf gets approved without reading.

### CI/CD

**Where we are:** ✅ `auto-deploy.yml` on merge to `main`, per-app deploy workflows,
turbo-affected computation, production URL verification.

---

## Stage 6 — Maintain: close the loop on metrics

This is the stage that makes it a loop, and the one most teams skip.

**A control band is a threshold range for a metric that triggers a response when
breached.** Set the bands from a metric with a stable baseline, using mean and
standard deviation over a rolling window with Western-Electric-style rules, so they
catch slow drift as well as spikes.

**A deterministic script watches production and invokes Claude when a band is
breached.** The detection is entirely deterministic — no model in the path. It is
version-controlled and unit-tested like any other code.

Escalate by severity:

| Breach | Response |
| :--- | :--- |
| 1σ | log only |
| 2σ | Claude diagnoses in read-only mode |
| 3σ | Claude may act, via PR or a pre-approved runbook |

**Then it writes back.** The agent records its diagnosis as an `intent.md` in the
Stage 1 format — the anomaly and its evidence, a proposed outcome, the affected
systems, open questions — and the loop restarts. Incidents re-enter the pipeline
instead of rotting in a separate ticket queue.

**Where we are:** ✅ `eslint/scripts/control-bands.ts` — a deterministic, unit-tested
watcher over the bands in `.agent/control-bands.json`, with all four Western Electric
rules and the 1σ/2σ/3σ tiering. `control-bands.yml` runs it weekly; on a 2σ+ breach it
writes the diagnosis as `.sdlc/intents/control-band-<id>/intent.md` and opens **a PR, not an
issue**, so the finding re-enters the pipeline.

Two honest caveats:

- The seeded bands hold three observations each. Below `minPoints` the watcher says
  so and computes nothing — a band cannot gate on history it does not have, and it
  accumulates one run at a time.
- A GitHub issue is still the channel when a *watcher itself* breaks, which is not a
  finding but an outage of the loop.

`eslint/docs/DOCS_QUALITY.md` carries the band table: metric, target, the check that
holds it, cadence.

---

## Reading our own state

| Stage | State |
| :--- | :--- |
| 1 Plan — `intent.md` | ✅ template + lock |
| 2 Design — `spec.md` | ✅ template + lock (`approved` requires one) |
| 3 Build | ✅ strong (CLAUDE.md, skills, worktrees) |
| 4 Test — feedback loops | ✅ strong |
| 4 Test — continuous evals | ✅ two layers; layer 2 needs `ANTHROPIC_API_KEY` |
| 5 Deploy — AI review + hooks + CI/CD | ✅ strong, ask-gate added |
| 6 Maintain — watchers | ✅ σ bands, Western Electric, tiered |
| 6 Maintain — write-back to `intent.md` | ✅ a breach opens an intent PR |

Every stage is loaded, not merely wired:

- **Five control bands**, four of them computing today. History was recovered from git
  — the suites prune dated result files, so the tree held three observations while git
  held twelve. `--backfill-git` walks the deleted ones. The fifth band holds six
  points and says so rather than pretending.
- **Twenty eval cases**, the playbook's lower bound, each drawn from a real incident
  in this repo and each pinned by a lock that rejects a case whose prompt gives away
  its own answer. That lock immediately caught six of the first drafts.
- **Two real intents**, both for decisions genuinely open right now, and one carries
  its `spec.md`.

What it still needs is **time and use**:

1. **Use it.** Write the next change's `intent.md` before touching code. Two exist;
   neither was written under deadline pressure, which is the real test.
2. **`ANTHROPIC_API_KEY`** as a repo secret, or eval layer 2 stays skipped forever and
   only the free layer runs.
3. **Let the bands accumulate.** Four speak now; more history makes 2σ mean something
   rather than being an artifact of a short window.
4. **One eval per incident, from here on** — written by whoever owned it.

---

## For agents reading this

- **Starting work?** If there is no `intent.md` for it, write one first — it costs a
  few minutes and it is what Stage 6 will eventually write back into.
- **Planning?** Plan mode, then commit the result as `spec.md`. A plan that lives
  only in chat cannot be reviewed or replayed.
- **Building?** Give yourself a one-command feedback loop before you start, and do
  not edit the tests to make it pass.
- **Finishing?** A fix is not done until a check would have caught it — see
  `eslint/CLAUDE.md`. Prove the check fails on the unfixed state.
- **Editing `CLAUDE.md`, a skill or a hook?** That is a configuration change: run
  `npm run ai-sdlc:score` before and after, and put both in the PR.
