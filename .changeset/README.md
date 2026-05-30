# Changesets

This repo uses [Changesets](https://github.com/changesets/changesets) for versioning + publishing the single npm package: **`@interlace/foundation`**.

All other workspaces (`@interlace/ui`, `@interlace/storybook`, `@interlace/landing`, `registry`) are listed under `config.json`'s `ignore` array — they are workspace-internal and distributed via the [Interlace shadcn registry](https://ds.interlace.tools) at `ds.interlace.tools`, not via npm.

## Adding a changeset

```bash
npm run changeset
# pick @interlace/foundation
# pick bump type (patch / minor / major) — see packages/foundation/README.md § Versioning
# write a one-line summary
# commit the .changeset/<name>.md file with your PR
```

## What happens on merge to main

`.github/workflows/release.yml` runs the Changesets action:

- If there are any pending changesets, opens (or updates) a **Version Packages** PR that bumps versions + writes CHANGELOG.md.
- When that PR is merged, the workflow re-fires and runs `npm publish` for any package whose version changed.

Requires the `NPM_TOKEN` repository secret (see [`SECURITY.md`](../SECURITY.md)). Set up `NPM_TOKEN` once before the first publish; the token must have `publish` scope on `@interlace`.

## Why foundation first?

CSS is stable, semver-friendly, and decoupled from React component churn. We get the npm publish pipeline live without committing to publishing 42 primitives. If a future consumer wants `import { Button } from "@interlace/primitives"` instead of shadcn-CLI vendoring, the next package follows this pattern — package-per-tier, never package-per-component.
