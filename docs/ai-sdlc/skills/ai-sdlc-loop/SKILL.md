---
name: ai-sdlc-loop
description: Run "create intents, design plans, then execute" as one loop that stops at the two human gates.
---

# The AI-SDLC as a loop

The stages and gates are in `interlace/docs/ai-sdlc/AI-SDLC.md`, and the loop practices in
`LOOPS.md` beside it. A program decides the stage, so this skill does not:

```bash
# interlace's origin/main copy, whatever branch the local checkout is on:
git -C ~/repos/ofriperetz.dev/interlace show origin/main:scripts/ai-sdlc/next.mjs > "${TMPDIR:-/tmp}/next.mjs"
node "${TMPDIR:-/tmp}/next.mjs" <repo> <slug>…   # exit 1: agent work, the first line is yours. exit 0: stop.
```

## Start

1. One intent per outcome the user asked for: `.sdlc/intents/<slug>/intent.md` (or `docs/intents/`
   where the repo keeps them), from the repo's `_template`, else from interlace's
   `docs/ai-sdlc/templates/`. The spec template carries the `**Check:**` line. Commit them.
2. Arm the loop with the built-in `/goal`, naming only these slugs:
   `/goal node "${TMPDIR:-/tmp}/next.mjs" <repo> <slugs> exits 0, stop after 30 turns`

## Each pass

Run `next.mjs` with those slugs and do its **first agent line**, then commit with a progress note,
so a new session can resume from git: one intent at a time.

- **1 Plan / 2 Design:** write the file it names. A spec names `**Check:** \`<cmd>\``, one command
  that exits 0 when the intent is done, agreed before any code.
- **3 Build → 4 Test:** in a worktree on `sdlc/<slug>`, under `/goal \`<check>\` exits 0`. A separate
  reviewer with fresh context (`/code-review`, or the repo's verify skill) checks the build; the
  builder grading its own work is what this stage exists to prevent. The PR carries the intent's
  `Status: shipped`. The merge is the Deploy gate, and a human takes it (rule 3).

## Stop

When `next.mjs` exits 0, report what it printed: what shipped and what waits on a human, with links.
The two gates stay with the human: approving a spec, and merging the PR.
