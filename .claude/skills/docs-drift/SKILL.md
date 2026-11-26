---
name: docs-drift
description: Find docs that no longer match the code in this repo and open a draft PR with the corrections. Weekly via /loop 7d, a scheduled task, or /schedule.
model: sonnet
argument-hint: [days back, default 7]
---

Budget: at most ~15k tokens. One draft PR per run, at most.

1. Changes: `git fetch -q origin main && git log origin/main --since="${ARGUMENTS:-7} days ago" --name-only --format=`
   — the code files (not docs, tests, lockfiles, generated pages) changed in the window.
2. For each changed exported symbol, CLI flag, config key, or command, find the docs that name it
   (README*, docs/, apps/*/content/, *.mdx, CLAUDE.md, AGENTS.md) with the repo-searcher subagent.
3. A doc **drifted** when it states something the code at origin/main no longer does: a renamed
   flag, a removed option, a changed default, a wrong count, an example that would now fail.
   Verify each one by reading the code or running the example. A doc that is merely incomplete is
   not drift; skip it.
4. No drift: say "No docs drift since <date>" and stop.
   Drift: branch `claude/docs-drift-<date>` from origin/main, fix only the drifted lines, run the
   repo's doc checks, commit with a `Verified-by:` line, push, and open a **draft** PR listing each
   correction with the commit that caused it. Never merge it.
