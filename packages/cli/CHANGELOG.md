# interlace-ui

## 0.3.0

### Minor Changes

- 8d66ad2: check: tell whether your copied components still match a release. `interlace-ui check` reads your components.json, finds every file that came from the registry and compares it, byte for byte after line endings, with the released item: matches a release, behind, modified locally, ahead of any release, or missing. It exits 1 on drift (`--strict` counts files behind the release too), 2 when it could not check, takes an allow list (`--allow`, or `.interlace-check.json` with a reason per file; it says when an allowed file matches a release again) and prints JSON with `--json` for CI and agents.

  Fix: `add button --cwd ./web` (and `-c`, `--path`, `-p`) passes the folder to shadcn instead of reading it as a component name.

## 0.2.0

### Minor Changes

- 542add4: Add `interlace-ui`, a CLI front door for the registry: `npx interlace-ui add button`.

  `add` and `init` delegate to the shadcn CLI rather than writing files
  themselves, so installs stay byte-identical to
  `npx shadcn@latest add <url>`. `list` and `info` are the new part — the shadcn
  CLI has no way to browse a third-party registry.

  Names resolve as a superset, never a replacement: a bare name or `@interlace/x`
  resolves here, while `@other/x` and absolute URLs pass through untouched, so one
  `add` can span registries. `init` registers the `@interlace` alias in
  `components.json`, which is what keeps plain `shadcn add @interlace/button`
  working with or without this package.

  Zero runtime dependencies; Node 20.11+.
