---
name: pr-review
description: First-pass review of open PRs across ofri-peretz repos — correctness, security, CLAUDE.md rules — posted as one comment per PR. Made for /loop, a scheduled task, or a GitHub-triggered routine.
model: sonnet
argument-hint: [repo or PR URL; default every open non-draft PR updated in 24h]
---

Budget: at most ~6k tokens per PR, 10 PRs per run. Skip what you cannot finish; list it at the end.

Scope: ${ARGUMENTS:-every open, non-draft PR in ofri-peretz repos updated in the last 24h,
excluding chore(release) PRs and PRs you already reviewed at their current head SHA}.
Find them with `gh search prs --owner ofri-peretz --state open --draft=false --updated ">=$(date -v-1d +%F)"`.

For each PR:
1. Read the diff with the diff-reader subagent, not in this conversation.
2. Run `/code-review medium` on it. Keep only findings with a concrete failure scenario.
3. Post ONE comment (`gh pr comment`) headed `First-pass review @ <short head SHA>` with the
   findings ranked, or "No blocking findings" — so a rerun can tell it already reviewed this head.
   Never approve, request changes, push, or merge.

End with a table: PR · findings · link.
