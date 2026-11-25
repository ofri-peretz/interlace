# How an AI-authored change is verified

Most pull requests in this repository are written by agents. This page is the path every one of
them takes from idea to merge, and what each step proves. A human contributor follows the same
path; nothing here is weaker for an agent.

The rule behind it: **a rule an agent can break is a check, not a sentence.** Prose in
`AGENTS.md` and the craft skill says what good looks like. The gates below make the parts a
machine can judge impossible to skip.

## The path

| Step                              | Who                                      | What it proves                                                                          | Where it lives                                                                                                                  |
| --------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 1. Read the rules                 | Author agent                             | It knows the design rules before writing UI                                             | [`AGENTS.md`](../AGENTS.md), [craft skill](../.claude/skills/interlace-craft/SKILL.md), [`CONTRIBUTING.md`](../CONTRIBUTING.md) |
| 2. Pick work nobody else holds    | Author agent                             | No two agents edit the same files                                                       | Open PRs and the area a running task has claimed                                                                                |
| 3. Write the change with its test | Author agent                             | A fix has a test that fails on the old code; a component has stories for every state    | `packages/ui/__tests__/`, `apps/storybook/src/stories/`                                                                         |
| 4. Local gate                     | Hooks                                    | Typecheck, tests (lock tests included), build and the agent-guidance lint all pass      | `npm run ci:local` ([`lefthook.yml`](../lefthook.yml))                                                                          |
| 5. Commit and push                | Hooks                                    | Conventional commit with a real scope; a `Verified-by:` receipt; hooks were not skipped | commitlint, provedone (`lefthook.yml` commit-msg), [`.claude/hooks/guard-bash.mjs`](../.claude/hooks/guard-bash.mjs)            |
| 6. CI                             | GitHub Actions                           | Everything a machine can judge (next table)                                             | [`.github/workflows/`](../.github/workflows/)                                                                                   |
| 7. Independent review             | A reviewer that did not write the change | The diff matches the review checklist below                                             | [`claude-code-review.yml`](../.github/workflows/claude-code-review.yml) when enabled, or a separate review agent                |
| 8. Merge                          | Author agent                             | Squash merge once every required check is green and the branch is current with `main`   | GitHub                                                                                                                          |
| 9. Release and adoption           | Release workflow, then consumers         | A changeset becomes a version; consumers take it                                        | [`release.yml`](../.github/workflows/release.yml), [versioning](philosophies/VERSIONING_PHILOSOPHY.md)                          |

The guard hook denies `--no-verify`, `git commit -n`, `LEFTHOOK=0` and hand-written CI polling
loops. Wait on CI with `gh pr checks <PR> --watch` or a PR subscription.

## What CI checks

| Job                                   | Catches                                                                                                                                                                                                                                                            |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| typecheck, test (lock + unit), build  | Type errors, broken behaviour, and every design rule written as a lock test: motion, contrast, container scale, breakpoints, theme contract, CSS layers, logical text-align, touch targets and more                                                                |
| lint (oxlint, eslint, agent guidance) | Code smells, security patterns, a11y in JSX, and guidance rules aimed at agents                                                                                                                                                                                    |
| registry (drift)                      | Registry output out of date with sources, items that fail the official shadcn schemas, token file drift, an item without a version, release notes that name components that do not exist                                                                           |
| changeset                             | A change to `packages/ui` without a changeset                                                                                                                                                                                                                      |
| registry (e2e install)                | An item that does not install into a fresh Next.js app                                                                                                                                                                                                             |
| storybook (a11y)                      | An axe violation in any story, in every theme                                                                                                                                                                                                                      |
| storybook (visual)                    | A pixel change in any component's default story, in light, dark, phone, right-to-left, 150% text and more contrast, against committed baselines                                                                                                                    |
| storybook (a11y matrix)               | An axe violation at phone width, right-to-left, 150% text or more contrast (AAA there); a page that scrolls sideways on a phone or at 150% text; a focus stop with no visible change. Known failures are listed in `visual/a11y-known.json`, which may only shrink |
| codeql                                | Security issues in the code                                                                                                                                                                                                                                        |

When a lock test fails, fix the component or the token, not the test. A change to a check lands
in its own PR, says why, and never in the same PR as the code it would let through.

## The review checklist

A reviewer reads the diff and checks only the rows whose trigger matches. Findings are tagged
`must-fix`, `should-fix`, `nit` or `pre-existing`, each with the reason it matters.

| Trigger in the diff                                   | Check                                                                                               |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| A behaviour change or a bug fix                       | Is there a test that fails on the old code?                                                         |
| A new component                                       | Does the PR carry everything in [Adding a component](../CONTRIBUTING.md#adding-a-component)?        |
| A colour, size, gap, radius, duration or easing       | Does it come from a token, not a literal value?                                                     |
| A consumer would need a `className` for a common case | Is a prop, variant or compound part missing?                                                        |
| A product name, brand colour, font or copy            | Interlace is brand-neutral. Does it belong in a consumer's tokens instead?                          |
| Motion                                                | Does it explain a change, keep the content in the server HTML, and do nothing under reduced motion? |
| Text or interactive colour                            | Does it meet AA, aiming for AAA on body text, in light, dark and more contrast?                     |
| Keyboard, focus or touch                              | Is there a keyboard path, a visible focus ring clear of text, and a 44px target where it applies?   |
| Layout                                                | Does it reflow at 320px and at 150% text size, and work right-to-left?                              |
| A test, lock, baseline or workflow changed            | Is this the only kind of change in the PR, and is the reason in the description?                    |
| A visual baseline was updated                         | Is the visual change intended and described in the PR?                                              |
| Exported API changed                                  | Are the stories, docs, the craft skill and `llms` surfaces updated with it?                         |

Misses the reviewer finds in merged PRs go in [`lessons.md`](lessons.md), each with the check that
would have caught it. A miss that happens twice becomes a check.

## Three rounds, then a person

If a check still fails after three rounds of fixing, the agent stops and reports what it tried.
It never skips a check, retries until a flaky run passes, or edits a check to make its own change
pass.

## What a person decides

Agents decide reversible engineering and design choices themselves and merge their own green
PRs. A person decides anything that costs money (for example turning on paid snapshot testing),
anything that cannot be undone, and submitting the registry to an outside directory.

## Keeping this page true

When a gate is added, removed or changed, update the tables above in the same PR. A row that
names a check that no longer exists is a bug.
