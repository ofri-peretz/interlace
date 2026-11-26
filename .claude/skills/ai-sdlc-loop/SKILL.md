---
name: ai-sdlc-loop
description: Run the AI-SDLC as one autonomous loop. Use when asked to create intents, design plans or specs, then execute or build them, or to "take this from idea to PR". Stops only at the two human gates or when every intent has shipped.
---

# The AI-SDLC as a loop

The stages and gates are in `interlace/docs/ai-sdlc/AI-SDLC.md`; the loop practices in
`LOOPS.md` beside it. Do not re-derive either. The program decides the stage:

```bash
# interlace's origin/main copy, whatever branch the local checkout is on:
git -C ~/repos/ofriperetz.dev/interlace show origin/main:scripts/ai-sdlc/next.mjs > "${TMPDIR:-/tmp}/next.mjs"
node "${TMPDIR:-/tmp}/next.mjs" <repo> <slug>…   # exit 1: agent work, the first line is yours. exit 0: stop.
```

## Start

1. One intent per outcome the user asked for: `.sdlc/intents/<slug>/intent.md` (or `docs/intents/`
   where the repo keeps them), from the repo's `_template`, else from interlace's
   `docs/ai-sdlc/templates/` (`git -C ~/repos/ofriperetz.dev/interlace show origin/main:docs/ai-sdlc/templates/intent.md`).
   The spec template carries the `**Check:**` line. Commit them.
2. Arm the loop with the built-in `/goal`, naming only these slugs:
   `/goal node "${TMPDIR:-/tmp}/next.mjs" <repo> <slugs> exits 0, stop after 30 turns`

## Each pass

Run `node "${TMPDIR:-/tmp}/next.mjs" <repo> <slugs>`. Do the **first agent line** and nothing else, then commit with a
progress note so a new session can resume from git (one intent at a time).

- **1 Plan / 2 Design:** write the file it names. A spec must name `**Check:** \`<cmd>\``: one
  command that exits 0 when the intent is done, agreed before any code.
- **3 Build → 4 Test:** in a worktree on `sdlc/<slug>`, under `/goal \`<check>\` exits 0`. Then a
  separate reviewer with fresh context (`/code-review`, or the repo's verify skill) checks it.
  Never grade your own build. Open the PR with the intent's `Status: shipped` in it. Do not enable
  auto-merge: the merge is the Deploy gate, and a human takes it (rule 3).

## Stop

When it exits 0, report what it printed: what shipped and what waits on a human, with
links. Do not cross a human gate yourself. Do not approve a spec or merge your own PR, and do not
set `Status: approved`.
