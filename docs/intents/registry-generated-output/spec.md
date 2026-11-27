# Design — a feature PR carries sources only; the release commits the registry output

Intent: [intent.md](./intent.md).

## Options weighed


| Option | Verdict |
| :-- | :-- |
| Keep committing in PRs, rely on the merge driver | What failed: GitHub ignores it. |
| A bot commits the output to main after each merge | Per-merge history kept, but main requires a PR and only an admin may bypass; a `GITHUB_TOKEN` push is refused. Needs a PAT or App with admin. Not available. |
| A bot opens a "regenerate" PR after each merge | Its checks never start (PRs opened with `GITHUB_TOKEN` trigger no workflows), so it cannot merge. |
| Stop committing the output; build it in CI and on deploy; commit it only in the release commit | **Chosen.** Needs no token and no change to branch protection. |

## Rejected alternatives

The first three rows of the table above: relying on the merge driver (GitHub ignores it), a bot
commit to main (needs an admin token), and a bot "regenerate" PR (its checks never start).

## Decision


1. A feature PR commits sources only. The gate `registry (no generated output in PRs)` fails a
   PR whose diff against its merge base touches a generated file, and prints the command that
   puts them back. The release branch (`changeset-release/*`) is the one exemption.
2. The output is rebuilt from source by every build (`npm run generate -w registry`), so the
   deployed registry (Vercel runs the registry build) and every consumer fetching `/r/*.json`
   from ds.interlace.tools always serve main's current sources. Nothing about the URLs changes.
3. `version-packages` runs `generate` (all generators, not only `build-registry`), so the Version
   Packages commit carries the whole output. Committed output on main is therefore the last
   release's.
4. The drift gate changes form, not strength. On a feature PR and on main it regenerates from the
   sources under test and then runs every check it ran before (items match sources, official
   shadcn schemas, tokens, versions, changelog compiles and references real components): a
   generator that throws, writes an invalid item or is not deterministic still fails. On the
   release branch, where the commit carries the output, the checks run against the committed
   files with no regeneration, exactly as before. `registry (e2e install)` regenerates first so
   it installs what these sources produce.

## Consequence to accept


Committed `apps/registry/public/r` on main now moves at release, not at every merge. A consumer
that reads the committed files from git (not the deployed registry) sees the last release.
WhyLikeDis's "Interlace files" check reads main's git history of the built registry, so a site
file adopted from an unreleased Interlace change matches nothing until the next Version Packages
PR merges: the site adopts releases (its own rule), and the cadence of that PR is now the cadence
of adoption.
