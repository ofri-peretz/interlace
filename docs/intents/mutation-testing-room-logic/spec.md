# Spec: mutation testing for the room and game logic

Status: draft for acceptance at Design→Build. Intent: [intent.md](./intent.md).
Read against `origin/main` of `interlace-ds-viz` and the `oxmutate` 2.14.0 README and
`package.json` in `burgee-relage/packages/oxmutate`, 2026-11-26. Anything about `oxmutate`
that this spec could not confirm from those files is marked **verify** and is a build step with
a stated fallback, not an assumption.

This is not a component. The component floor's headings are answered as follows: API → §3
(interface), states → §5, a11y contract → §6 (callers), test plan → §7, stories → §8 (none, and
why), out of scope → §9, open questions → §10.

## 1. Decision record: which tool

Principle 2 (zero external dependencies) binds **published packages**. `@interlace/ui` is
`private: true` and the registry hands consumers copied source, so a development tool reaches no
consumer under any option below. The rule therefore does not exclude a candidate; what it asks for
is the smallest supply chain to audit, and principle 4 asks for the choice to be measured.

| Option | For | Against |
| --- | --- | --- |
| **`oxmutate`** (Ofri's, MIT, `burgee-relage/packages/oxmutate`) | Dependencies: `bellpull` and `burgee` only, both from the same family, none outside it (its `package.json`). Runs the project's own Vitest warm (`peerDependencies: vitest >=4.1.0`; this repo has `^4.1.10`). Reads Stryker config keys, so the door back to Stryker stays open. `--since`, `--frozen-oracle`, `--incremental`, `--shard i/n`, SARIF, `survivors --json`, `--mcp` are in its README. `ignore` entries require a `reason`. Dogfood by a second repo is principle 11's "an adopter is an article". | Self-grading: the owner of the tool grades the owner's repo. Version 2.14 is young in this repo. Three new devDependencies (`oxmutate`, `bellpull`, `burgee`) and a native binary per platform: new files for the endpoint scanner on first install. Config for the dry run must exclude coverage (see §4.2). |
| Stryker (`@stryker-mutator/core` + the Vitest runner) | The incumbent; most examples online; no self-grading. | A large transitive tree (count at build time with `npm view <pkg> dependencies`, no install); per its README `oxmutate` claims a Vitest run per mutant here against a warm worker there, which this repo has **not** measured. |
| A script of our own | No dependency. | Reinvents a parser and mutator set badly; the kit would own a tool, not a design system. Rejected. |
| Coverage only (today) | Already at 100. | Cannot fail a test that runs code and asserts nothing. This is the gap. |

**Decision: `oxmutate`**, pinned to an exact version in `devDependencies` of the root (so the
lockfile records provenance), conditional on two build-time proofs recorded in this folder's
`DECISION.md` (committed with the first PR, the numbers filled in then, none from memory):

1. **Control run against the incumbent.** One time, off-hours, one process, in a scratch
   directory outside the repo (`npx` Stryker, not added as a dependency): mutate `room-model.ts`
   with both tools and record per-mutant verdict agreement and the survivors each reports that the
   other does not. Acceptance default: agreement of at least 95% on this file, and every
   disagreement read by a person. Below that, fall back to Stryker's lane with the same files in
   §3. (`oxmutate`'s own 99.9% figure is measured on its corpus, not ours, and is not cited as ours.)
2. **Supply-chain count.** `npm view oxmutate dependencies`, the same for `bellpull` and `burgee`,
   and the platform packages; record the number of packages and that the version on npm carries
   provenance. If `oxmutate` is not published at the pinned version, stop and ask Ofri.

## 2. Scope

Globs, relative to `packages/ui`, in `mutation/scope.json` (the single source; the config and the
lock both read it):

```json
{
  "include": [
    "src/games/*-model.ts",
    "src/games/daily.ts",
    "src/patterns/*-model.ts"
  ],
  "exclude": [
    { "file": "src/games/qr-model.ts", "reason": "decided after the first full run: kept only if one file stays under the 8 minute shard budget", "decidedBy": "first-run" }
  ]
}
```

- Today's set is the pure core already held at 100% coverage: `daily`, `streak-model`,
  `closer-model`, `share-model`, `leaderboard-model`, `tally-model`, `quiz-model`, `order-model`,
  `qr-model`, `room-model`, `duel-model`, `progress-model`, `reminder-model`, `text-safety-model`,
  `word-cloud-model` (2,400 lines or so), plus the `patterns/*-model.ts` files in the coverage
  glob. `room-model.ts` (645 lines) and `text-safety-model.ts` carry the most consequence.
- **Models that arrive later enter by name.** `photo-upload-model.ts` and
  `getting-started-model.ts` match `patterns/*-model.ts`, and the room-facilitation models
  (teams, breakouts, pairs, agenda) match as soon as they follow the `-model.ts` name. A model
  with another name is caught by the **scope lock** (§7.3).
- **A file is in at a floor or out with a written reason.** `exclude` entries carry a reason and
  are counted; the count can only fall.
- Not in scope: `.tsx`, stories, `primitives/`, `lib/`, `charts/`, the other packages.

## 3. Interface

### 3.1 Files

| Path | What |
| --- | --- |
| `packages/ui/mutation/scope.json` | §2 |
| `packages/ui/oxmutate.config.json` | `include` from scope, `thresholds: { high: 90, low: 70, break: 0 }` (the per-file gate is the ratchet, not this number), `reporters: ["clear-text","html","sarif","json"]`, `ignore` entries (each with `reason`), vitest options per §4.2 |
| `.sdlc/bands/mutation-floor.json` | per-file floors (§3.2) |
| `.sdlc/bands/mutation-survivors.json` | the survivor ledger (§3.3) |
| `scripts/mutation-ratchet.mjs` | zero dependencies, Node only: `--check`, `--write`, `--scope-lock` |
| `scripts/mutation-ratchet.test.mjs` | `node --test`, the ratchet's own tests (§7) |
| `packages/ui/mutation/canaries/` | five hand-written breaks (§3.5) |
| `packages/ui/mutation/control/` | a tiny weak model plus a weak test, and a strong test (§7.2) |
| `.github/workflows/mutation.yml` | `pr` job, `nightly` shard matrix, `control` job |
| `docs/intents/mutation-testing-room-logic/DECISION.md` | the two proofs in §1 |

`package.json` scripts: `mutate` (full run, for CI and for a human who chose to), `mutate:since`
(`oxmutate run --since origin/main`), `mutate:ratchet` (`node scripts/mutation-ratchet.mjs --check`),
`mutate:control`. None is wired into `lefthook.yml`.

### 3.2 `mutation-floor.json`

```json
{
  "$comment": "Floors only rise. `mutation-ratchet --check` fails a lower floor, a removed file, or a higher ignoreBudget, against origin/main.",
  "measured": { "command": null, "date": null, "tool": null, "node": null },
  "ignoreBudget": null,
  "files": {
    "src/games/room-model.ts": { "floor": null, "mutants": null, "killed": null, "survived": null, "timeouts": null, "ignored": null }
  }
}
```

Every `null` is "recorded when measured": the first full run (a build step, run once by a person
on CI or an unloaded machine) fills them, `floor` being that run's per-file score rounded **down**
to a whole percent. `mutants` is the number the **scope-shrink guard** compares (§5). No score is
set from memory or from an allowance.

### 3.3 `mutation-survivors.json`

Generated by `mutation-ratchet --write` from `oxmutate survivors --json`, never hand-edited:

```json
{ "survivors": [
  { "id": "<oxmutate stable mutant id>", "file": "src/games/room-model.ts", "line": 412,
    "mutator": "ConditionalExpression", "class": "killable | equivalent | unreachable",
    "reason": "required for equivalent and unreachable", "since": "2026-12-01" }
] }
```

### 3.4 Exit codes and what each caller reads

| Caller | Reads |
| --- | --- |
| Person at a terminal | the clear-text table (file, score, floor, headroom, survivors), the HTML report |
| Coding agent | `oxmutate survivors --json` (file, line, mutator, a `fix:` line saying what to assert), or `--mcp` |
| CI | exit code (0 pass; non-zero fails; `oxmutate` exits 3 when the dry run fails, **verify** that a score under `break` is non-zero), SARIF annotations on the diff, a job summary table |
| Screen reader | the text table and JSON. The HTML report's accessibility is **not measured or claimed** |

### 3.5 Canary mutants

Five hand-written patches in `mutation/canaries/*.patch`, one per authority rule of
`applyRoomEvent`: a non-host may send a host event; a locked room admits a new player; an expired
code admits a new player; a full room admits a player; an answer is accepted twice. The nightly
applies each in a throwaway worktree, runs the room tests, and **each must fail**. They do not
depend on `oxmutate`, so a misconfigured scope that scores 100% on nothing cannot hide a broken gate.

## 4. Pipeline

### 4.1 Lanes

| Lane | When | What | Gate |
| --- | --- | --- | --- |
| `pr` | pull request touching `packages/ui/src/{games,patterns}/**`, `packages/ui/__tests__/**`, `.sdlc/bands/mutation-*`, `scripts/mutation-ratchet.mjs`, `mutation/**` | `oxmutate run --since origin/${base} --frozen-oracle origin/${base} --reporter sarif,html,json`, then `mutation-ratchet --check` | no survivor outside the ledger on changed lines; frozen oracle clean (a change that weakens its own tests exits 1 and names each mutant); floors and ledger monotone against base; scope lock |
| `nightly` | schedule and `workflow_dispatch` | full run in 4 shards (`--shard i/n`, shards partition by mutant hash), reports merged, `--incremental` cache keyed by lockfile + hash of scope files and their tests | per-file score at or above `floor`; mutant count at or above the guard; canaries red; control green |
| `control` | with every `pr` and `nightly` | `mutation/control/` weak and strong pair (§7.2) | weak fails and names its survivor; strong passes |

A `merge_group` trigger is added with the same job names if the merge queue branch lands.
Required status check names (`mutation / pr`) are set in branch protection by Ofri; that is a
Deploy-stage human step listed in the PR, not something the change does.

### 4.2 Running the project's Vitest

`packages/ui/vitest.config.ts` has coverage **enabled** with 100% thresholds. A mutation dry run
under that config would instrument twice and could fail on thresholds. The build must not touch
those settings (lowering is not an option the next session gets). It adds
`packages/ui/vitest.mutation.config.ts`, `mergeConfig(base, { test: { coverage: { enabled: false },
reporters: ['dot'] } })`, and points `oxmutate` at it. **verify** the key for naming a Vitest
config in `oxmutate.config.*`; if it reads only `vitest.config.*`, the fallback is an environment
variable read by the existing config to turn coverage off, added in a separate, reviewed commit.
`environment` stays `jsdom` (some model tests are `.tsx`); moving model tests to `node` is a later,
measured speed-up only if the budget breaches.

### 4.3 Budgets (limits we choose, not measurements)

| Run | Budget |
| --- | --- |
| `pr` job wall clock, install cached | 6 minutes |
| `nightly` per shard | 10 minutes; whole workflow 25 |
| any single file, full | 8 minutes on one shard; over that the file gets its own shard before it is excluded |
| local, by hand | one file, one run at a time, `pgrep -f oxmutate` empty first, never from a background agent beyond the two-agent cap, never in a hook |

The first full run records actual mutants, wall time and peak memory into the floor file's
`measured` block. A budget breach on 3 of 10 consecutive runs writes a new intent (shard more,
turn on `--incremental`, or narrow scope); a budget is raised only by a person, with the number.

## 5. States of the gate

| State | Result |
| --- | --- |
| Floors and ledger unchanged, no new survivor | pass |
| A floor lowered, a file removed from `files`, `ignoreBudget` raised, an `exclude` added | fail, names the entry |
| A survivor on a changed line not in the ledger | fail, prints file:line, mutator, the `fix:` line |
| A survivor fixed (id gone from the report) | pass; `--write` removes it from the ledger; the PR must include that diff or `--check` says so |
| A file's score exceeds its floor by 2 points or more **and the PR touched that file or its test** | fail with "raise the floor" and the exact `--write` command (the same idea as the registry drift check) |
| Dry run fails, zero mutants, or `mutants` below 50% of the recorded count for a file | fail (the gate never passes on scoring nothing) |
| A mutant timeout | counted as detected, listed, and the timeout count is recorded; a rising count is shown, not failed |
| A new `*-model.ts` neither in scope nor excluded | fail (scope lock) |
| Flaky tests (`oxmutate` reports a `flaky` verdict) | not counted as killed; the run lists them; two in a row on the same file opens a follow-up in `docs/follow-ups/` |
| Tool or runner crash (exit not 0, not a score) | fail; never retried until it passes (retry only by a person, once, with the log kept) |

## 6. Survivor triage

Every survivor gets one class, decided by the PR's author (a person or an agent) and checked by a
reviewer who did not write the code. A survivor sits in the ledger only until it is resolved.

| Class | Meaning | What to do | Ledger |
| --- | --- | --- | --- |
| **killable** | a behaviour a test should have pinned | Add an assertion to the existing test or a new case: a **boundary table** for comparisons (`now == endsAt`, `players == max`), the **exact rejection code** for each refusal, a **second event** for `seq` and idempotence, a **before/after** for pure reducers. Then re-run that file only (`mutate:since`). Never edit a test to make a mutant pass by weakening it; `truepass` (already in pre-push) refuses weakened assertions. | removed when killed |
| **equivalent** | the mutation changes no observable behaviour (a `>=` that cannot see equality because the values are never equal; a defensive `Math.max(0, x)` on a non-negative input) | Write the reason as a sentence a reviewer can disprove; add an `ignore` entry with `reason` in `oxmutate.config.json` (mutator-level) or ledger class `equivalent` (single mutant). Counted against `ignoreBudget`, which can only fall. | stays, with reason |
| **unreachable** | the surviving line cannot be reached through the public API (the case `vitest.config.ts` records for `skeleton.tsx`'s `default:` arm) | Prefer deleting the line. If it is defence against a future bad input, keep it and say so in the file where the reason will be read; never an `ignore` without the sentence. | stays until deleted |

- A person or an agent starts from `oxmutate survivors --json`: one record per survivor, its
  file, line, mutator and a `fix:` line. The agent's output is the new assertions and the ledger
  diff; a different agent or a person reviews (the writer does not verify).
- A survivor on a **changed line** is the author's to resolve in the same PR. A survivor found by
  the **nightly** on an untouched line opens an issue labelled `mutation-survivor` with the
  record, and is resolved within the next sprint or recorded `equivalent`/`unreachable`; it is
  never silently merged into the ledger by a bot.
- Frequent finds in this domain, to look for first: time boundaries (`>=` versus `>` on `endsAt`,
  `startsAt`, `codeExpiresAt`), ranking ties, `seq` increments, the order of validation checks
  (which rejection wins), and a streak's first and last day. These are examples of where to look,
  not a claim of what will be found.

## 7. Test plan

The gate is a check, so by the repo's rule it is **shown failing on each broken state** before it
is trusted. The ratchet script has its own tests; the workflow has a control.

### 7.1 `mutation-ratchet` (`scripts/mutation-ratchet.test.mjs`, `node --test`, run in the existing `test` job)

Fixtures are tiny JSON files for base and head. Cases: unchanged passes; each §5 failing row has
a case with the exact message; `--write` is idempotent and produces the monotone diff; a floor
rounded down never exceeds the measured score; unknown keys in the floor file fail (no drift in
shape); the ledger refuses an `equivalent` without `reason`; the headroom rule only fires when the
PR touched the file or its test; the scope lock reads `scope.json` and the file tree.

### 7.2 The control (`mutation/control/`)

A 20-line pure model and two test files: `weak.test.ts` runs every line but asserts only one
branch; `strong.test.ts` asserts all. The `control` job runs the lane against each: **weak must
exit non-zero and print the surviving mutant; strong must exit 0.** This is principle 3's "control
run proving the gate", on every run, for the cost of one tiny file.

### 7.3 Deliberate-break proofs (each done by hand once, recorded in the PR; the first six also scripted into `mutation-ratchet.test.mjs` or the control)

| Break | Must be red because |
| --- | --- |
| Lower any `floor` by 1 | `--check`: floor below base |
| Delete a file's entry from `files` | `--check`: file removed |
| Raise `ignoreBudget` | `--check`: budget raised |
| Add a `*-model.ts` under `src/games/` that is not in scope or `exclude` | scope lock |
| Add an untested `if` to `room-model.ts` | `pr` lane: new survivor not in ledger, with file:line |
| Delete one assertion from `games-streak.test.ts` (a rest-day boundary) | `pr` lane: frozen oracle exits 1 naming the mutant, on a PR that touches no model |
| Apply each of the five canary patches | nightly canary step: the room tests fail (if one passes, the step fails) |
| Make the dry run fail (`it.only` on a failing test) | exit 3, never green |
| Narrow `include` so one file scores nothing | mutant-count guard: below 50% of recorded |
| Raise a file's score by two points in a PR touching its test without bumping | headroom rule: "raise the floor" |
| Turn on coverage in the mutation config | dry run fails on thresholds (proves §4.2 is load-bearing) |

### 7.4 Evidence the first PR must carry

`DECISION.md` with the control comparison (§1.1) and the supply-chain count (§1.2); the first full
run's table (per file: mutants, killed, survived, timeouts, score, wall time, command, date);
the triage of every survivor of that run by class; the new tests that killed the killable ones,
each showing red against its mutant first.

## 8. Storybook stories

None: this is not a component. The documentation equivalent is one page, "How the tests are
tested", under the existing docs, with the table from §5, the triage table from §6, how to run one
file by hand, and the floor file's contents rendered from the JSON (never typed). A score appears
there only once the floor file has it, with its command and date.

## Out of scope

Mutating components, stories, primitives, `lib`, charts, other packages; a pre-push or pre-commit
hook; a hosted dashboard; a coverage change; Stryker-format dashboards upload; mutation of the
registry scripts (`scripts/*.mjs`), which can enter by a later intent on evidence; Quint or spec
oracles (a feature `oxmutate` has, not asked for here); retries until green; a score target other
than "the floor, and it rises".

## 10. Open questions, each with the default the build agent takes

| Question | Default |
| --- | --- |
| Ledger as well as floors, or floors alone? | Both: the ledger is what makes "one fixed, one added" red. Generated, never hand-written. |
| Is `ignoreBudget` a count or a per-file cap? | A total count, set at the first run, falling only. |
| Does the PR lane need `--frozen-oracle`? | Yes: it is the only check that sees a PR weakening a test without touching a model. |
| Run `qr-model.ts` (419 lines, table-heavy)? | Include; decide at the first run against the 8-minute file budget (own shard before exclusion). |
| Where does the nightly report URL live? | The job summary and an artifact; no hosted page. |
| Node and OS for CI? | `ubuntu-latest`, the repo's `.nvmrc` (24.x). `oxmutate` declares `>=22.13`. |
| `oxmutate` flag to name the Vitest config, and to cap workers, **verify** | If absent, the §4.2 fallback; cap workers by `OXMUTATE_*` env or runner size. |
| Does a score below `break` exit non-zero? **verify** | If not, `mutation-ratchet` reads the JSON report and exits 1 itself (it must anyway for per-file floors). |
| Per-mutant inline ignore directive syntax? **verify** (`directives` exists in the source) | Prefer ledger `equivalent` entries; inline only if the syntax is documented and carries a reason. |
| Stryker control under 95% agreement? | Fall back to Stryker's lane on the same scope; the floors and ledger formats do not change. |
| Do component tests ever join? | Not by default; propose per file with a measured cost, as the coverage glob grew. |
| Announce it? | Only after the first full run has real findings: a changelog line, then a post if the findings are worth reading (principle 11). |
