# @interlace/registry — shadcn-compatible component registry

Serves `@interlace/ui` primitives as shadcn-compatible JSON entries. Production URL: **`ds.interlace.tools`**.

Consumers install components with the standard shadcn CLI:

```bash
npx shadcn@latest add https://ds.interlace.tools/r/button.json
npx shadcn@latest add https://ds.interlace.tools/r/dialog.json
```

## How it works

```text
packages/ui/src/primitives/*.tsx
              │
              ▼
   scripts/build-registry.mjs
              │
              ▼
       public/r/<name>.json   ← what Vercel serves
       public/r/index.json    ← list of all items
```

Each `public/r/<name>.json` follows the [shadcn registry-item schema](https://ui.shadcn.com/schema/registry-item.json):

```json
{
  "$schema": "https://ui.shadcn.com/schema/registry-item.json",
  "name": "button",
  "type": "registry:ui",
  "title": "Button",
  "description": "@interlace/ui — button primitive (shadcn-compatible).",
  "dependencies": ["@base-ui/react", "class-variance-authority"],
  "registryDependencies": [],
  "files": [
    {
      "path": "registry/interlace-ui/button.tsx",
      "target": "components/ui/button.tsx",
      "type": "registry:ui",
      "content": "…"
    }
  ]
}
```

`dependencies` (npm packages) and `registryDependencies` (other items in this
registry) are auto-extracted from `import` statements in the source `.tsx` file.

### Two rules the generator enforces that are easy to get wrong

1. **`registryDependencies` must be absolute URLs.** A bare name means "a
   shadcn/ui core component" to the CLI, so `"theme"` sends it to
   `ui.shadcn.com/r/…/theme.json` and the install dies. Ours emit
   `https://ds.interlace.tools/r/theme.json`.
2. **Every import must resolve in the consumer's tree.** Sibling `.ts`
   companions (`button-variants.ts`) ship inside the item's `files[]`;
   cross-tier imports (`../primitives/skeleton.js` from a pattern) are
   rewritten to `@/components/ui/skeleton` *and* declared as dependencies.

Both rules exist because `scripts/e2e-install.mjs` caught them being violated.

## Categorisation

`registry-categories.json` is the single source of truth. The generator stamps
a `categories` array onto every item (intent + DS tier), and
`src/lib/categories.ts` reads the same file for the titles/descriptions the
site renders. Never categorise a component anywhere else — `--check` fails on
any item that resolves to `other`.

## Versions and release notes

Every item carries `meta.version` / `meta.since`, and every installed `.ts(x)`
file carries a four-line banner naming its version — because `shadcn add`
copies the source into the consumer's tree, where nothing else can tell them
which copy they have.

| File | Role |
| --- | --- |
| `component-versions.json` | the manifest: `{ name, version, since, updated, deprecated? }` per item. **Generated** — `npm run versions:derive` (from the repo root) derives it from git history. `deprecated` is hand-authored and survives regeneration. |
| `scripts/derive-component-versions.mjs` | the derivation. Introduction = 1.0.0; every later commit applies its conventional-commit bump; a change to a **companion** (`button-variants.ts`) bumps its parent. |
| `scripts/build-changelog.mjs` | compiles `packages/ui/CHANGELOG.md` + pending `.changeset/*.md` into `public/data/changelog.json` — the one source behind both `/changelog` and each component's History section. |

The manifest is committed and the registry build **reads** it rather than
calling git, deliberately: a version derived from `HEAD` at build time would
rewrite every item on every commit and put the drift gate in a permanent fight
with itself. Full reasoning:
[`docs/philosophies/VERSIONING_PHILOSOPHY.md`](../../docs/philosophies/VERSIONING_PHILOSOPHY.md).

## Verification

| Command | What it proves |
| --- | --- |
| `npm run build:check --workspace=registry` | on-disk JSON matches the sources, every item validates against the official shadcn schemas, and the release notes compile |
| `npm run changelog:check --workspace=registry` | `changelog.json` is current, every `Components:` name is a real item, and every breaking entry has a migration note |
| `npm run versions:check` (repo root) | every shipped item has a version-manifest entry, and every entry names a shipped item |
| `npm run registry:validate --workspace=registry` | schema conformance + no dangling `registryDependencies` + index covers every item |
| `npm run registry:e2e --workspace=registry` | **every item actually installs**: scaffolds a real Next.js app, `shadcn add`s all of them through the `@interlace` namespace, wires the CSS baseline, and `next build`s the result |
| `npm run schema:refresh --workspace=registry` | re-downloads the upstream schemas into `schema/` — commit the diff so a spec change is reviewable |

`e2e-install-results.json` holds the last verified run and is committed. The
E2E job runs in CI on every PR (`registry (e2e install)`).

## Adding a new primitive

1. Drop the file in `packages/ui/src/primitives/<name>.tsx`. Annotate the header with the interlace-component skill rule citations (use `dialog.tsx` or `button.tsx` as the template).
2. Run `npm run build` from this workspace:

   ```bash
   npm run build --workspace=registry
   ```

3. Verify the new `public/r/<name>.json` appears and conforms to the schema.
4. Commit `public/r/<name>.json` + `public/r/index.json`.

CI runs `npm run build:check` on every PR — fails if the on-disk JSON is out of sync with the primitive sources.

## Local preview

```bash
npm run build --workspace=registry
npm run preview --workspace=registry
# → serves on http://localhost:4178
```

Open `http://localhost:4178/` for the landing page and `http://localhost:4178/r/button.json` for a sample entry.

## Vercel deployment

`vercel.json` declares:

- **`Cache-Control: public, max-age=300, s-maxage=3600, stale-while-revalidate=86400`** on `/r/*.json` — short browser cache, long edge cache, with stale-revalidate so consumers see fresh content within minutes of a deploy.
- **`Access-Control-Allow-Origin: *`** — so the shadcn CLI can fetch cross-origin from any project.
- **Security headers** on everything else (X-Content-Type-Options, Referrer-Policy).

Hookup:

1. Create a new Vercel project, **Root Directory** = `apps/registry`.
2. **Domain** → `ds.interlace.tools`.
3. **DNS** → CNAME `ds` to `cname.vercel-dns.com`.
4. Trigger first deploy via push to `main`.

## What gets included

Five source tiers ship, each landing in its own subdirectory of the consumer's
`components/ui/` so provenance survives the install:

| Source | Consumer target | Item type |
| --- | --- | --- |
| `packages/ui/src/primitives/*.tsx` | `components/ui/<name>.tsx` | `registry:ui` |
| `packages/ui/src/patterns/*.tsx` | `components/ui/patterns/<name>.tsx` | `registry:ui` |
| `packages/ui/src/templates/*.tsx` | `components/ui/templates/<name>.tsx` | `registry:block` |
| `packages/ui/src/magicui/*.tsx` | `components/ui/magicui/<name>.tsx` | `registry:ui` |
| `packages/ui/src/aceternity/*.tsx` | `components/ui/aceternity/<name>.tsx` | `registry:ui` |

`packages/ui/src/blocks/` is intentionally NOT scanned — those paths are
one-line re-export aliases for `patterns/` kept for one release cycle.

## See also

- [`scripts/build-registry.mjs`](scripts/build-registry.mjs) — the build pipeline.
- [`packages/ui/CONVENTIONS.md`](../../packages/ui/CONVENTIONS.md) — the conventions every primitive must follow.
- [`INTERLACE.md`](../../../agents/INTERLACE.md) — top-level index of the design-system stack.
- [`SKILL.md` for interlace-component](../../../agents/skills/interlace-component/SKILL.md) — the 26-rule floor every primitive must clear.
