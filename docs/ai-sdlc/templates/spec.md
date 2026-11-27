# Design — `<short title>`

Intent: [`intent.md`](./intent.md). **Status:** draft.

---

## Requirements

Numbered, testable statements. `R1`, `R2`, … so the PR and the tests can cite them.

## Design

How it works. The shape of the change, the files it touches, the order to do it in.

## Verification

The feedback loop: the one command that exits non-zero when this is wrong, and the
check that would have caught the original problem. Name the test file.

**Check:** `<command that exits 0 when this intent is done>`

The loop's Build stage runs under `/goal` on this line, so it must exist before any code
(`scripts/ai-sdlc/next.mjs` refuses to build without it).

## Rejected alternatives

What we chose not to do, with the reason. Per CLAUDE.md rule 3, this is the section a
future reader cannot reconstruct from the diff — and the one that stops the same
option being proposed again every quarter.

## Out of scope

What this deliberately does not do, so scope creep has to argue for itself.
