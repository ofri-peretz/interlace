---
'interlace-ui': minor
---

Add `interlace-ui`, a CLI front door for the registry: `npx interlace-ui add button`.

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
