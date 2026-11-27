# Decision: oxmutate, and what was read to decide

Read on 2026-11-26 from the npm registry and the published `oxmutate@2.19.0` tarball (README, `--schema`, `dist/`), not from memory. The spec was written against 2.14.0; this pins 2.19.0.

## The "verify" items of the spec, resolved

| Spec item | Answer, with where it was read |
| --- | --- |
| Is `oxmutate` published, and at what version? | Yes. `npm view oxmutate`: `latest` is **2.19.0** (modified 2026-11-26), MIT, `bin: oxmutate`, `engines.node >=22.13.0`. Pinned exactly in the root `devDependencies` (`"oxmutate": "2.19.0"`), with an integrity hash in `package-lock.json`. |
| Supply chain | `npm view oxmutate@2.19.0 dist.attestations`: **SLSA provenance present** (`predicateType https://slsa.dev/provenance/v1`), registry signature present. Dependencies: `burgee ^2.2.3` and `bellpull ^2.0.3`; `burgee` brings `roundel`, `bellpull`, `closeout`, `linegauge`, `seniority`. A scratch install (`npm i oxmutate@2.19.0` in an empty directory) installs **7 packages**. In this repo's lockfile **one** is new (`oxmutate`): the other six were already there (hookset uses `burgee`). Vitest is an optional peer (`>=4.1.0`; this repo has `^4.1.10`). |
| Exit code for a score below `break` | `oxmutate --schema` and the README: `0` ok, `1` it ran and the result failed (below `--break`, or the change weakened its tests), `2` usage, `3` the config or the suite did not load (a dry run that fails). Seen directly: the control's weak test exits **1**, the strong one **0**. |
| How to name the Vitest config | The config key is `vitestConfig` (`Options.vitestConfig` in `dist/config.d.ts`), but it is not needed: oxmutate runs the **project's own** Vitest from the directory it is run in, and forces `coverage: { enabled: false }` for its own runs (`dist/child.js`). `vitest.config.ts` (coverage on, 100% thresholds) is therefore **not touched**, and the spec's `vitest.mutation.config.ts` is not created. The control directory has its own tiny `vitest.config.ts` to choose weak or strong by an environment variable. |
| Ignore syntax | `// Stryker disable next-line <Mutator>: <reason>` and `// oxmutate disable <Mutator>: <reason>` ranges are read from the source (`dist/directives.js`); a `disable` **without a reason is an error** ("fix: add `: <why these mutants cannot be killed>`"). Config-level: `ignore: [{ call: "console.*", reason: "..." }]`. The spec's default stands: prefer a ledger `equivalent` entry, and use an inline comment only with its reason. |
| Flags the lanes use | All present in 2.19.0: `--since <ref>`, `--frozen-oracle <ref>`, `--shard i/n`, `--incremental`, `--break`, `--reporter clear-text,json,sarif,html`, `--report-dir`, `--config`, `survivors --json`, `--mcp`. There is **no** `--vitest-config` flag and none is needed. |

## Things the README says that matter here

- The README's own decision `D-20261101-no-mutation-in-gha` is about publishing benchmark numbers (they are taken on a quiet machine); it does not stop a project using the tool in CI, and the README shows a CI workflow for it. It does mean: no score from a shared runner is quoted as a benchmark of the tool.
- The README's **99.9% verdict agreement with Stryker** was measured on es-toolkit and two burgee packages, not on this repo. It is not cited as ours.

## Still open (not measured, so not claimed)

1. **The control run against Stryker** on `room-model.ts` (spec §1.1, acceptance 95% agreement, every disagreement read). Not run: it needs an unloaded machine and a scratch directory outside the repo, and this repo's machine rules ask for one heavy run at a time. Until it is recorded here, `oxmutate` is accepted provisionally and the intent's status stays `draft`. Below 95% agreement the fallback is Stryker's lane on the same scope; the floor and ledger formats do not change.
2. **The first full run** (mutants, killed, survived, timeouts, score, wall time, command, date, per file). The floor file reads "recorded when measured" until the first nightly's artifact is written into it with `node scripts/mutation-ratchet.mjs --write --report <shards> --command "<command>"`.
3. **Local proof of the configuration**, done on one small file by hand (see the PR): the control pair and `src/games/picture-reveal-model.ts`.
