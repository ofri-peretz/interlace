# Evidence ledger: Anthropic engineering → our baseline

Every post on [anthropic.com/engineering](https://www.anthropic.com/engineering) as of 2026-11-25,
the practice each one recommends, the result Anthropic **measured** for it (quoted, with what was
measured), and where we stand. "No measurement" means the post argues the practice without a
number, so we treat it as guidance, not proof.

Status: ✅ in the baseline and checked by the audit · 🟡 practised, not checked · ⬜ not adopted
· — not applicable to us.

Review this ledger when a new post appears. A new practice with a measured result goes into
[AI-SDLC.md](AI-SDLC.md) or gets a reason here for why not.

| ID | Post | Practice | Anthropic's evidence | Us |
| :-- | :-- | :-- | :-- | :-- |
| <a id="e-1"></a>E-1 | [Migrating our Messages API to Rust](https://www.anthropic.com/research/migrating-api-to-rust) (2026-11-25) | Shadow traffic through old and new implementations; group diffs by fingerprint | Input match ~24% → 99.6%; ~70% less CPU and >80% less memory per request | — (compat-oracle in burgee is the same idea for CLI parity) |
| <a id="e-2"></a>E-2 | [Building strong safety evaluations](https://www.anthropic.com/research/building-strong-safety-evaluations) (2026-11-13) | State what an eval measures before collecting data; validate graders against human labels | Surface gap up to 34 points between API and claude.ai on the same eval | 🟡 eslint benchmark ground truth |
| <a id="e-3"></a>E-3 | [The components of agent memory](https://www.anthropic.com/research/components-of-agent-memory) (2026-11-06) | Offline "dreaming" pass checks memory notes against transcripts | CL-Bench, Opus 5.5: 0.655 → 0.838 with memory; wiki accuracy 13% → 48% as dreaming scaled 2 → 128 sessions | ⬜ memory files exist, no correction pass |
| <a id="e-4"></a>E-4 | [Redesigning source control at Anthropic](https://www.anthropic.com/research/redesigning-source-control) (2026-10-13) | Content-addressed servers; clients fetch only needed trees | 2,500 → 30,000+ merges/day; checkouts two orders of magnitude faster | — (our scale; reuse warm worktrees instead) |
| <a id="e-5"></a>E-5 | [How we contain Claude across products](https://www.anthropic.com/research/how-we-contain-claude) (2026-05-25) | Enforce limits at the environment layer; each allowlisted host is a capability grant | OS sandbox cuts permission prompts 84%; users approve ~93% of prompts | 🟡 hooks + deny rules |
| <a id="e-6"></a>E-6 | [April 23 postmortem](https://www.anthropic.com/research/april-23-postmortem) (2026-04-23) | Run a broad eval suite and ablations on every system-prompt change | One ablation showed a 3% drop on both Opus 4.6 and 4.7 | 🟡 eslint `evals.yml` fires on CLAUDE.md/hook changes |
| <a id="e-7"></a>E-7 | [Scaling Managed Agents](https://www.anthropic.com/research/managed-agents) (2026-04-08) | Stateless harness, sessions logged outside it | p50 TTFT −60%, p95 −90% | — |
| <a id="e-8"></a>E-8 | [How we built Claude Code auto mode](https://www.anthropic.com/research/claude-code-auto-mode) (2026-03-25) | Gate tool calls with an action classifier; measure FPR and FNR before granting autonomy | FPR 0.4% (n=10,000), FNR 17% on real overeager actions (n=52) | 🟡 release-gate hook asks before deploy/publish |
| <a id="e-9"></a>E-9 | [Harness design for long-running apps](https://www.anthropic.com/research/harness-design-long-running-apps) (2026-03-24) | A separate, skeptically tuned evaluator agent tests the live result | Full harness 6 h / $200 vs solo 20 min / $9: far better output at 20× the cost | ✅ Claude review (triggerlist) is a separate reviewer |
| <a id="e-10"></a>E-10 | [Eval awareness in BrowseComp](https://www.anthropic.com/research/eval-awareness-browsecomp) (2026-03-06) | Filter eval search results for benchmark identifiers | 9 of 1,266 runs contaminated; multi-agent 3.7× more unintended solutions | — |
| <a id="e-11"></a>E-11 | [Building a C compiler with parallel Claudes](https://www.anthropic.com/research/building-c-compiler) (2026-02-05) | High-quality tests are the verifier; keep test output short | 16 agents, ~2,000 sessions, 99% pass on most compiler suites | ✅ feedback loop; rtk + test-runner keep output short |
| <a id="e-12"></a>E-12 | [Quantifying infrastructure noise](https://www.anthropic.com/research/infrastructure-noise) (2026-02-05) | Guaranteed resources plus a hard kill limit per eval task | Infra errors 5.8% → 0.5%; 6-point score gap across setups (p<0.01) | 🟡 bench runners pin resources |
| <a id="e-13"></a>E-13 | [Designing AI-resistant technical evaluations](https://www.anthropic.com/research/AI-resistant-technical-evaluations) (2026-01-21) | Re-run take-homes against each new model | Opus 4.5 matched the best 2-hour human result | — |
| <a id="e-14"></a>E-14 | [Demystifying evals for AI agents](https://www.anthropic.com/research/demystifying-evals-for-ai-agents) (2026-01-09) | Start with 20–50 tasks drawn from real failures | CORE-Bench 42% → 95% after fixing grading bugs | ✅ eslint (20 cases), burgee; ⬜ other repos |
| <a id="e-15"></a>E-15 | [Effective harnesses for long-running agents](https://www.anthropic.com/research/effective-harnesses-for-long-running-agents) (2025-11-26) | Each session leaves a progress log and commits | No measurement | ✅ rule 1, intents |
| <a id="e-16"></a>E-16 | [Advanced tool use](https://www.anthropic.com/research/advanced-tool-use) (2025-11-24) | Defer rarely used tool definitions | ~77K → ~8.7K tokens (−85%); MCP accuracy, Opus 4.5: 79.5% → 88.1% | 🟡 Claude Code defers MCP tools; measured by start context |
| <a id="e-17"></a>E-17 | [Code execution with MCP](https://www.anthropic.com/research/code-execution-with-mcp) (2025-11-04) | Expose MCP servers as code APIs; load only what a task needs | One workflow 150,000 → 2,000 tokens (−98.7%) | ⬜ |
| <a id="e-18"></a>E-18 | [Beyond permission prompts](https://www.anthropic.com/research/claude-code-sandboxing) (2025-10-20) | OS-level filesystem + network isolation for shell commands | Permission prompts −84% | ⬜ sandbox not enabled |
| <a id="e-19"></a>E-19 | [Agent Skills](https://www.anthropic.com/research/equipping-agents-for-the-real-world-with-agent-skills) (2025-10-16) | Evaluate first, then build skills to close observed gaps | No measurement | ✅ skills, on-demand loading |
| <a id="e-20"></a>E-20 | [Effective context engineering](https://www.anthropic.com/research/effective-context-engineering-for-ai-agents) (2025-09-29) | Smallest set of high-signal tokens; subagents return 1–2K-token summaries | No benchmark | ✅ context ready gate, subagent-gateway |
| <a id="e-21"></a>E-21 | [A postmortem of three recent issues](https://www.anthropic.com/research/a-postmortem-of-three-recent-issues) (2025-09-17) | Run quality evals continuously on production | A routing bug reached 16% of requests at its worst hour, ~30% of Claude Code users | ✅ eslint + burgee control bands; ⬜ others |
| <a id="e-22"></a>E-22 | [Writing effective tools for agents](https://www.anthropic.com/research/writing-tools-for-agents) (2025-09-11) | Prototype a tool, iterate against held-out evals; concise responses | Concise response 72 vs 206 tokens (~⅓) | 🟡 burgee `--json` / MCP output |
| <a id="e-23"></a>E-23 | [Desktop Extensions](https://www.anthropic.com/research/desktop-extensions) (2025-06-26) | Bundle an MCP server as one `.mcpb` | No measurement | — |
| <a id="e-24"></a>E-24 | [Confidential inference via trusted VMs](https://www.anthropic.com/research/confidential-inference-trusted-vms) (2025-06-18) | Attestation-gated key release | No measurement | — |
| <a id="e-25"></a>E-25 | [Claude Code best practices](https://code.claude.com/docs/en/best-practices) (living doc) | Give Claude a pass/fail check; enforce must-never rules with hooks, not prose; CLAUDE.md under 200 lines | No measurement | ✅ context budget, rule 2, hooks |
| <a id="e-26"></a>E-26 | [How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) (2025-06-13) | Parallel subagents with own context; budget tokens | +90.2% over single-agent Opus 4 on internal eval; token use explains 80% of variance; ~15× the tokens of chat | ✅ subagent share tracked by the scorecard |
| <a id="e-27"></a>E-27 | [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents) (2024-12-19) | Simplest design that works; add complexity when measured | No measurement | ✅ rule 4, ponytail |
| <a id="e-28"></a>E-28 | [Contextual retrieval](https://www.anthropic.com/news/contextual-retrieval) (2024-09-19) | Contextual chunks; prompt caching for repeated context | Retrieval failures −67% with reranking; caching: latency >2× lower, cost up to 90% lower (no method given) | ✅ cache hit tracked by the scorecard |
| <a id="e-29"></a>E-29 | [The "think" tool](https://www.anthropic.com/engineering/claude-think-tool) (2025-03-20) | A think tool for policy-heavy tool chains | τ-Bench airline 0.370 → 0.570 (+54%) | — (extended thinking now preferred) |
| <a id="e-30"></a>E-30 | [SWE-bench Verified with Claude 3.5 Sonnet](https://www.anthropic.com/engineering/swe-bench-sonnet) (2025-01-06) | Minimal scaffolding; error-proof tools (absolute paths) | 49% vs prior SOTA 45% | 🟡 |

## Measured on our repos

Anthropic's numbers are for Anthropic's workloads. Ours are in the scorecard. A practice is
"proven here" only when a before/after scorecard run shows it.

| Change | Before | After |
| :-- | :-- | :-- |
| Baseline, 2026-11-25 | see [BASELINE-2026-11-25.md](BASELINE-2026-11-25.md) | — |
