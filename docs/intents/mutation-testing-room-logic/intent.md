# Intent — the tests of the room and game logic are themselves tested, and the bar only rises

**Status:** draft · **Opened:** `2026-11-26` · written from Ofri's list of remaining design-system gaps. Not accepted:
a human accepts at Design→Build. Lives at `docs/intents/mutation-testing-room-logic/intent.md`
with `spec.md` beside it.

## What is wanted

A CI check that changes the room and game logic one small step at a time (`>=` becomes `>`, a
rejection is skipped, a `seq` stops bumping) and fails when no test notices. Scope is the pure
models in `packages/ui` (`games/*-model.ts`, `games/daily.ts`, `patterns/*-model.ts`): the code
where one wrong character means a player is let into a locked room, a code works after it
expired, two answers count, or a streak resets a day early. The score per file is a **floor
recorded in a file, and the floor can only rise**: a pull request that lowers it, drops a file
from scope without a written reason, or adds a surviving mutant that nobody triaged, is red.

Four things are asked for in the same change: a tool decision, a scope, a ratchet, and a rule for
what happens to each survivor.

## Why now

- `packages/ui/vitest.config.ts` holds these models at **100% lines, statements, functions and
  branches**, by a lock ("a file is in at 100 or it is out"). Coverage says a line *ran*. It does
  not say a test would *notice* the line being wrong. A model at 100% coverage with a test that
  never asserts on a boundary passes today and would pass after the boundary broke.
- The models are the authority of the live room (`applyRoomEvent`: not-host, locked, expired,
  full, removed, wrong-phase, already-answered), of streak and goal arithmetic, and of
  `text-safety-model`. The room-facilitation work adds more pure state on top of them (teams,
  breakouts, pairs, agenda). Two new component specs (`photo-upload`, `getting-started-checklist`)
  each add a pure model that must enter this scope on the day it merges.
- Principle 4: *measured, or it is a slogan.* The kit says its tests are locked. Today that is
  measured by coverage alone; this adds the measurement that can fail a test that only runs code.
- Ofri owns a mutation tool, `oxmutate` (`burgee/packages/oxmutate`, 2.14.0 in the checkout read on
  2026-11-26), built for this job and graded against Stryker's verdicts. The ecosystem's own
  design system is the first adopter that is not the tool's own repo.

## Constraints

- **The floor only rises, and a machine says so.** The floors live in a committed file; a PR
  that lowers one, removes one, or adds a survivor outside the ledger fails a check; that check is
  shown failing on each of those breaks.
- **The gate cannot pass by scoring nothing.** A run with no mutants, a dry run that fails, or a
  file whose mutant count fell to half of what is recorded is red, never green.
- **The machine is spared.** This never runs in the pre-push hook (that is already 3 to 4 minutes
  and the laptop is CPU-limited). It runs in CI, on changed lines in pull requests and in full,
  sharded, at night. A local run is by hand, one file, one at a time.
- **Every survivor is accounted for.** Each is killed by a new assertion, or recorded as an
  equivalent mutant with a reason, or the dead code it exposes is deleted. "Ignore" is never a
  silent option, and the count of reasons is itself capped.
- **Every caller is served.** A person reads a table; an agent reads `survivors --json` with a
  `fix:` line per survivor; CI reads exit codes and SARIF annotations.
- **No claim without a command and a date.** The first measured scores go into the floor file with
  the command that produced them; nothing in a README or a post quotes a score before then.

## Decisions already taken (the spec carries the reasoning)

| Decision | Why |
| --- | --- |
| Use `oxmutate`, with a one-time Stryker control run before the floor is set | It has no dependency outside Ofri's family, runs the project's own Vitest warm, speaks Stryker's config, and gives pull-request, SARIF and agent surfaces the repo needs. Self-grading is a real risk, so the control run compares verdicts on one real file against the incumbent and records the agreement. |
| Floors are per file, not one average | An average can be raised by adding easy lines to a strong file while a weak one rots. |
| A survivor ledger beside the floors | The score can stay flat while one survivor is fixed and another added. The ledger names survivors, so a new one is red even at the same score. |
| PR lane scores changed lines only; the full run is nightly | Cost follows the diff on the machine and in CI minutes; the floors are still enforced every night. |
| A scope lock: every `*-model.ts` is in scope or excluded with a reason | A new model that nobody added to a list would otherwise be untested by the gate, silently. |
| Hand-written canary mutants for the five room authority rules | The tool's own mutator set could be misconfigured into scoring 100% on nothing; five breaks written by hand must go red every night regardless. |

## Left out

- Mutating `.tsx` components, stories, primitives, the registry app, the CLI. Components are
  covered by render tests and Storybook plays; they are a later scope decision, per file, on
  evidence.
- Running mutation locally on a hook, or on every push.
- A hosted dashboard. The numbers are a committed JSON file and a job summary.
- Replacing coverage. Coverage stays at 100 for the same files; this check sits beside it.

## Success criteria

- First full run recorded in the floor file: mutants, killed, survivors, timeouts, score, wall
  time and the command, per file, with the date. Before that the cells read "recorded when measured".
- Pull-request lane within its runtime budget on 9 of 10 consecutive PRs that touch scope; nightly
  within its budget every night. A breach writes a new intent (shard more, or narrow the scope).
- Zero untriaged survivors on `main`. Floors never lower: proved by the check, not by promise.
- A milestone is done when public (principle 11): the first run's findings (what survived, what
  was killed by a new test) become a changelog line and, if they are worth reading, a post.

## Open questions

Listed with a default in `spec.md` §10.
