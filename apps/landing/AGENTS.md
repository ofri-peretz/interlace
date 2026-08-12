# AGENTS.md — apps/interlace-landing

Apex landing site for the Interlace ecosystem (interlace.tools). Third consumer of `@interlace/docs-baseline`.

## Rules

- **`.interlace/` is an orphaned snapshot — edit it in place.** The banners in there tell you not to, and to re-run `npm run docs-baseline:sync` in the agents repo instead. That generator still runs, but this app is **not** one of its four targets (see `agents/interlace/docs-baseline/interlace.targets.json`), so the sync never reaches here and edits are durable. Details in [README.md](./README.md#the-interlace-folder). Anything under `.interlace/components/ui/` is a drifted snapshot of `packages/ui/src/primitives/` — fix the DS copy first (it has the tests), then port.
- **Brand tokens live in the baseline.** This site's `src/app/global.css` only imports from `.interlace/css/*`; do not redefine brand variables here.
- **Site-specific UI** goes under `src/components/`. The synced shared pool lives at `.interlace/components/`.
- **MDX content** under `content/docs/`. Frontmatter must include `title` and `description` (validated by `src/__tests__/mdx-frontmatter.test.ts`).

## When changing the home page

The home page (`src/app/(home)/page.tsx`) is the ecosystem directory — it lists each `*.interlace.tools` subdomain product. When a new sibling repo joins, update both the directory grid here and the `interlace.targets.json` entry under [interlace/docs-baseline/](../../interlace/docs-baseline/).

## Verify before commit

```bash
npm run docs-baseline:sync:check   # no baseline drift
npx vitest run                     # internal links + frontmatter + nav structure
npm run build                      # production build succeeds
```
