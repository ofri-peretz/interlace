# Running the AI-SDLC as an autonomous loop

How a request like "create intents, design plans, then execute" runs to the end without
anyone typing "continue". [AI-SDLC.md](AI-SDLC.md) defines the stages. This page says which
loop runs each one and what stops it. Evidence IDs point to [EVIDENCE.md](EVIDENCE.md).

## The rule underneath: a program decides, Claude acts

Anything a program can check is a program, not prose for Claude to read: the stage an
intent is in, whether a gate is open, whether the work is done. Prose costs context on every
turn and can be misread; an exit code cannot ([E-20](EVIDENCE.md#e-20), [E-25](EVIDENCE.md#e-25)).

`scripts/ai-sdlc/next.mjs` is that program. It reads the intents and prints the next step of
each, and who takes it. Exit 1 means an agent has work; exit 0 means nothing is left for an
agent: everything is done or waiting on a human.

```bash
node scripts/ai-sdlc/next.mjs <repo> <slug>…   # only the intents this request created
```

## Which loop runs which stage

Claude Code ships four kinds of loop ([E-31](EVIDENCE.md#e-31)). Each stage uses the
simplest one that works ([E-27](EVIDENCE.md#e-27)).

| Stage | Loop | Stops when | Who |
| :-- | :-- | :-- | :-- |
| 1 Plan, `intent.md` | turn-based | every section filled, `Status: review` | agent |
| 2 Design, `spec.md` | turn-based | the spec names its `**Check:**` | agent |
| Design→Build gate | none: a human | `Status: approved` | human (rule 3) |
| 3 Build + 4 Test | goal-based: `/goal` | the spec's check exits 0, a fresh-context reviewer passed it | agent |
| 5 Deploy gate | none: a human | the PR merges | human (rule 3) |
| 6 Maintain | time-based or proactive: `/loop`, `/schedule` | a control band breaches → a new `intent.md` | routine |

The whole request is one goal-based loop:
`/goal node scripts/ai-sdlc/next.mjs <repo> <slugs> exits 0`. Each time Claude tries to stop,
the condition is checked. While agent work remains, it keeps going. It ends at a human gate
or when everything has shipped, and says which.

## Practices every loop follows

1. **A deterministic stop condition, decided before the work starts.** Tests pass, a score
   clears a threshold, `next.mjs` exits 0. Vague done-criteria stop too early or run too long
   ([E-31](EVIDENCE.md#e-31)). The spec names its check first, and the generator and the
   evaluator agree on it before any code exists: the sprint contract ([E-9](EVIDENCE.md#e-9)).
2. **Bound every loop.** A turn limit ("stop after 5 tries"), a timeout on every hook and
   check, and a stated end: the PR merges, the queue empties ([E-31](EVIDENCE.md#e-31)). A
   loop that cannot end is a bug.
3. **The builder never grades its own work.** A separate reviewer with fresh context checks
   the result. Agents praise their own output, and a standalone evaluator is far easier to make
   skeptical ([E-9](EVIDENCE.md#e-9)).
4. **Resume from files, not memory.** Commit each step with a progress note. A new session
   reads the git log and the intent, then continues ([E-15](EVIDENCE.md#e-15), rule 1).
5. **One unit of work at a time.** One intent, one feature per pass. Attempts to one-shot
   everything run out of context mid-feature ([E-15](EVIDENCE.md#e-15)).
6. **Humans monitor and step in, not approve every action.** Approval stays only where an
   action cannot be undone: the two gates, publishing, money ([E-32](EVIDENCE.md#e-32), [E-8](EVIDENCE.md#e-8)).
7. **The cheapest model that does the job.** Reading, searching and routine runs go to
   Haiku or Sonnet workers. Only their summary enters the main context ([E-31](EVIDENCE.md#e-31), [E-20](EVIDENCE.md#e-20)).
8. **No routine faster than what it watches changes.** Wake on events (a notification, a
   finished run). Poll only what cannot notify, at its own pace ([E-31](EVIDENCE.md#e-31)).
9. **Pilot before fan-out.** Run a slice first. A large workflow can spawn hundreds of agents
   ([E-31](EVIDENCE.md#e-31)).
10. **Every harness part is an assumption about the model.** Remove parts one at a time and
    keep only what holds results up ([E-9](EVIDENCE.md#e-9)). The false-alarm rate of each hook
    is how we tell.
11. **When a result misses the bar, fix the system, not only the instance.** A new check, a
    skill, or a hook, so the next loop cannot repeat it (rule 4, [E-31](EVIDENCE.md#e-31)).

## Scheduled loops (Stage 6 and recurring work)

Start with `/loop` in a session to find what works. Promote it to a desktop scheduled task
when it must survive a restart. Promote it to a `/schedule` routine when it must run with the
laptop closed ([E-31](EVIDENCE.md#e-31)). Our recurring recipes are skills in
`.claude/skills/`, so a routine's prompt is one line: "use the `morning-briefing` skill".

| Skill | Cadence | Does |
| :-- | :-- | :-- |
| `morning-briefing` | weekdays 07:00 | Red main CI, PRs that need a human, new issues. Read-only |
| `pr-review` | on PR events | One fresh-context first-pass review per PR head. Never approves or merges |
| `docs-drift` | weekly | Docs the code contradicts → a draft PR on `claude/` |
