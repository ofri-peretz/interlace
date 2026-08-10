# Changesets — how a change becomes a release note

Every PR that touches `packages/ui/**` must add a changeset. CI enforces it
(`changeset` job in `.github/workflows/ci.yml`), and the enforcement is the
point: a changelog nobody is forced to write stops after two releases.

```bash
npx changeset          # interactive
```

Or write the file by hand — it is five lines.

## The shape

```md
---
'@interlace/ui': minor
---

MetricTable gains a `dense` row height for tables above 20 rows.

Components: metric-table, series-table
```

| Line                 | Required | Meaning                                                                                                                   |
| -------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------- |
| front-matter bump    | yes      | `major` → **Breaking**, `minor` → **Added**, `patch` → **Changed**. See `docs/philosophies/VERSIONING_PHILOSOPHY.md`.       |
| first paragraph      | yes      | The release note. Written for someone who installed the component three months ago, not for the reviewer of this PR.        |
| `Components: a, b`   | yes\*    | Registry item names this entry touches. They become links to `/c/<name>` and drive the per-component **History** section.   |
| `Kind: …`            | no       | Overrides the bump→kind mapping when a `minor` is a change rather than an addition. One of `Added`, `Changed`, `Breaking`.  |
| `Migration: …`       | major    | **Mandatory for every `major`.** The literal edit a consumer makes in their own copied source. Multi-line is fine.          |

\* Required unless the change touches no shipped item (tooling, docs, build).
Use `Components: none` to say so explicitly — a missing line is a build error.

Names are validated against the built registry by
`apps/registry/scripts/build-changelog.mjs`, so a typo in a component name
fails the build instead of rendering a dead link on ds.interlace.tools.

## Why this matters more here than for a normal package

`shadcn add button` **copies** source into the consumer's tree. From that
moment the two histories are unrelated — there is no `npm update`, no
`^1.2.0` range, no transitive upgrade. The changelog *is* the upgrade path,
and a breaking entry without a `Migration:` block is a dead end for everyone
who already installed the component.

## Example — a breaking change

```md
---
'@interlace/ui': major
---

`Badge` renames the `tone` prop to `variant` so every primitive spells its
closed union the same way.

Components: badge
Kind: Breaking
Migration: Rename `tone` to `variant` in your copy of
`components/ui/badge.tsx` and at every call site. The accepted values are
unchanged. `data-slot="badge"` is unchanged.
```
