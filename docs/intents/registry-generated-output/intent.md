# Intent — a feature PR carries sources only; the release commits the registry output

**Status:** shipped · **Opened:** `2026-11-26` · **Shipped in:** #253

Proposed by the coordinator on the merge train night; accepted when #253 merged. The options
weighed, the decision and its consequence are in [design.md](./design.md).

## What is wanted


Merging one PR to main must not turn the other open PRs DIRTY. Before this, every PR that
touched a component also committed the rebuilt registry output (`apps/registry/public/r/**`,
`data/**`, `.well-known/**`, `tokens/**`, `llms.txt`, `llms-full.txt`), and two such PRs
conflict on the aggregates (`index.json`, `registry.json`, `search-index.json`, `changelog.json`,
the llms files) the moment either lands. GitHub's "Update branch" and merge button ignore the
`interlace-generated` merge driver, so the conflict stops the train.

## Why now

On 2026-11-26 the merge train stalled: each merged component PR left the other open ones DIRTY on
the generated aggregates, and the merge driver cannot help through GitHub's buttons.

## Constraints

- No new token and no change to branch protection: a bot push or bot PR needs one or the other.
- Nothing about the registry URLs changes; the deployed registry always serves main's sources.
- The drift gate keeps its strength: every check it ran before still runs.

## Success criteria


`registry/src/__tests__/no-generated-in-prs.test.ts`: the gate fails a diff that touches
generated output and passes sources only; its definition of "generated" is held against every
tracked file under `public/`. `generated-merge-lock.test.ts` still holds the driver for the
release branch.
