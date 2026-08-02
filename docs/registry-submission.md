# shadcn Registry Directory — submission readiness (ds.interlace.tools)

**Audited:** 2026-08-02 · **Phase 2.2** of `DESIGN-SYSTEM-PLAN.md`
**Verdict: READY once this branch merges and `ds.interlace.tools` redeploys.**
**DO NOT SUBMIT** — outward-facing; gated on Ofri's explicit go.

---

## 1. What the directory actually requires (2026 process)

Source of truth: [`/docs/registry/registry-index`](https://ui.shadcn.com/docs/registry/registry-index)
and the validator [`apps/v4/scripts/validate-registries.mts`](https://github.com/shadcn-ui/ui/blob/main/apps/v4/scripts/validate-registries.mts),
both read at audit time.

### Process
1. Add an entry to [`apps/v4/registry/directory.json`](https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/directory.json) (264 entries as of audit).
2. Run `pnpm validate:registries` locally.
3. Open a PR against `shadcn-ui/ui`.
4. "it will be validated and reviewed by the team."

No form, no fee, no application. The namespace (`@interlace`) is what the directory
grants — public GitHub `owner/repo/item` addresses work without it.

### Stated requirements (verbatim)
- "The registry must be open source and publicly accessible."
- "The registry must be a valid JSON file that conforms to the registry schema specification."
- "The registry is expected to be a flat registry with no nested items i.e `/registry.json` and `/component-name.json` files are expected to be in the root."
- "The `files` array, if present, must NOT include a `content` property." *(applies to the root `registry.json` index — per-item files legitimately carry `content`; the CLI needs it.)*

### What the validator mechanically enforces
Only the directory entry's shape. It performs **no network fetch**:
```ts
name:        z.string().regex(/^@[a-zA-Z0-9][a-zA-Z0-9-_]*$/)
homepage:    z.string().url()
url:         z.string().refine(url => url.includes("{name}"))
description: z.string()
logo:        z.string()   // inline SVG markup
```
Everything else is **human review by the shadcn team**. That is why the gaps below
mattered: each is what a reviewer hits in the first 30 seconds by running
`shadcn add @interlace/button`.

`author` appears as an optional 6th key on some entries. Corpus medians: logo ~870
chars, description ~114 chars.

---

## 2. Audit results

| # | Requirement | Status | Evidence |
|---|---|---|---|
| R1 | Open source + publicly accessible | ✅ | `ofri-peretz/interlace` public, MIT, `ds.interlace.tools` serves 200 |
| R2 | Valid JSON per registry-item schema | ✅ | 122 items validated against `ui.shadcn.com/schema/registry-item.json`: 0 unknown keys, all `type` values in enum, all carry `title`/`description`/`target`/`content`, unique kebab-case names |
| R3 | Flat registry, `/registry.json` at root | ✅ **this branch** | was a live 404 — **G1** |
| R4 | Root index `files` has no `content` | ✅ | the index carries no `files` at all |
| R5 | Directory entry shape | ✅ ready | §4; `@interlace` is free (nearest existing: `@solaceui`) |
| R6 | Items install cleanly | ✅ **this branch** | was broken — **G2**. All 122 items now install into a clean project with **0 unresolved imports** |
| R7 | Docs quality | ✅ | per-component pages carry install, exports, anatomy, variants, R-rule compliance, min-viewport, deps, source |
| R8 | Maintenance signals | ⚠️ | active + CI-gated; 1 star, 0 repo topics, no CHANGELOG (§5) |

---

## 3. Gaps found, and what fixed them

The audit originally found five blockers. While it was being written, **PR #29
("make ds.interlace.tools a top-tier shadcn registry") landed independently and
fixed three of them** — bare `registryDependencies`, relative imports in patterns
and templates, and the malformed `meteors` CSS payload. Credit there, not here.

Two survived #29 and are fixed on this branch.

### G1 — `/r/registry.json` does not exist → `shadcn list`/`search` broken
```
$ shadcn list @interlace
✖ Unexpected token '<', "<!DOCTYPE "... is not valid JSON     # the Next.js 404 page
$ curl -so /dev/null -w '%{http_code}' https://ds.interlace.tools/r/registry.json
404
```
The CLI resolves the registry index at `<root>/registry.json`. The build emitted
only `index.json` — correct shape, wrong filename. This also failed R3 outright,
which alone would have sunk the submission.

**Fix:** the build writes both. `index.json` stays as the alias
`src/lib/registry.ts` reads.

### G2 — `button` and `skeleton` import `*-variants` files the registry never published
```
button:   import "@/components/ui/button-variants"   names no item
skeleton: import "@/components/ui/skeleton-variants" names no item  (×2)
```
Both cva companions live in `*-variants.ts`, and the primitives scan filtered on
`.tsx` only — so they were invisible to the build. `button` is the single most
likely item a reviewer installs, and it arrived with an unresolvable import.

**Fix:** the scan takes `.ts` too and `buildItem` derives the extension from the
filename. Registry: 120 → 122 items. Both companions are categorised in
`registry-categories.json` alongside their parents (`form`, `feedback`).

### The gate that stops all of this recurring
The existing drift check asserted "built output matches disk" — it could not see
that an item was uninstallable, which is how five blockers shipped undetected.
`assertRegistryContract` now runs on every build **and** in `--check` (CI), and
rejects:
1. a bare `registryDependencies` entry (resolves against shadcn's registry, not ours);
2. a relative import surviving into `content`;
3. a dependency or `@/components/ui/*` import naming an item we do not ship.

Verified to fire: removing `.ts` from the scan reproduces exactly the three G2
errors and exits 1.

### Verification
- `build-registry.mjs --check` clean; contract violations **0** across 122 items.
- **Full install E2E**: every one of the 122 items installed into a clean
  `shadcn`-configured project via the real CLI — 118 files written, **0 unresolved
  imports**, 0 failed installs.

---

## 4. Prepared submission package

### 4a. `apps/v4/registry/directory.json` entry
Insert alphabetically. Validated against the validator's zod schema.

```json
{
  "name": "@interlace",
  "homepage": "https://ds.interlace.tools",
  "url": "https://ds.interlace.tools/r/{name}.json",
  "description": "Accessible React primitives, patterns and page templates on a WCAG 2.2 AA floor — brand tokens, skeleton variants and locked responsive breakpoints, installable with the shadcn CLI.",
  "logo": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 100 100\" width=\"100\" height=\"100\"><style> .o { fill: #f4794a } .g { fill: #0d9460 } @media (prefers-color-scheme: light) { .o { fill: #a84c17 } .g { fill: #0a6b47 } } </style><g transform=\"rotate(-30 50 50)\"><rect class=\"o\" x=\"10\" y=\"18\" width=\"62\" height=\"28\" rx=\"14\"/><rect class=\"g\" x=\"28\" y=\"54\" width=\"62\" height=\"28\" rx=\"14\"/></g></svg>"
}
```
Description is 181 chars (corpus median 114) — trim to the first clause if a
reviewer objects.

The `logo` is `apps/registry/public/favicon.svg` verbatim: two rotated bars,
orange + green, theme-responsive via `prefers-color-scheme` (395 chars vs the
corpus median 870). ⚠️ **One look before submitting** — this is not the angular
hexagonal "twist" mark the brand guidelines document, and a directory logo is a
durable public artifact. If the hexagon is the intended public face, swap it here.

### 4b. PR to `shadcn-ui/ui`

**Title:** `feat(registry): add @interlace to the registry directory`

**Body:**
```markdown
Adds `@interlace` — the Interlace design system registry — to the registry directory.

- **Homepage:** https://ds.interlace.tools
- **Registry:** https://ds.interlace.tools/r/{name}.json
- **Source:** https://github.com/ofri-peretz/interlace (MIT)

122 items: 57 primitives, 28 patterns, 13 page templates, decorative components,
a `registry:style` theme bundle and two `registry:lib` utilities. Every component is
built to a documented 26-rule floor — brand tokens only, a skeleton variant, locked
mobile-first breakpoints, and WCAG 2.2 AA contrast verified at the composite level.

Checklist:
- [x] Open source and publicly accessible (MIT)
- [x] Valid JSON conforming to the registry-item schema
- [x] Flat registry — `/registry.json` and `/<name>.json` at the root
- [x] Root `registry.json` carries no `files[].content`
- [x] `pnpm validate:registries` passes locally
- [x] Every item verified installable via `npx shadcn@latest add`
```

### 4c. Pre-submit gate
- [x] **G1** `/r/registry.json` emitted
- [x] **G2** `button-variants` + `skeleton-variants` published and categorised
- [x] CI gate (`assertRegistryContract`) covers all three uninstallability classes
- [x] E2E: all 122 items install into a clean project; 118 files, 0 unresolved imports
- [ ] **Merge this branch and let `ds.interlace.tools` redeploy** — every claim above
      is verified against the local build; the live site still 404s `/r/registry.json`
- [ ] Post-deploy re-verify against the live origin: `shadcn list @interlace`, one `add`
- [ ] **Ofri's explicit go**

---

## 5. Not blocking, worth doing first

1. **The theme installs 5 CSS files and wires none of them.** After
   `shadcn add @interlace/theme` the consumer's `globals.css` is untouched — no
   `@import`. Wants a `docs` field carrying the import block.
2. **No `author` on any item.** Optional, but it is the field that attributes the
   work when someone reads a vendored file six months later.
3. **Repo signals:** 1 star, 0 topics, no CHANGELOG; `packages/ui/package.json`
   has no `license` field (root LICENSE is MIT). All cheap, all visible to a reviewer.

---

## 6. Two process notes for whoever picks this up

**Verify the branch before measuring.** `interlace/` is a shared checkout that
concurrent agents leave parked on feature branches. The first pass of this audit
measured `chore/interlace-dual-linter` and reported the palette as violet and the
favicons as unrepainted — both were already fixed on `main`. Check
`git branch --show-current` against `origin/main` before believing any reading.

**`apps/registry/public/r/*.json` is committed build output.** Every PR that
touches `packages/ui` regenerates all ~122 files, so every concurrent DS PR
conflicts with every other one there, and a registry PR can lose the merge race
repeatedly. It resolves mechanically (`node scripts/build-registry.mjs`, stage,
continue) but it is friction worth a decision: the deployed registry is rebuilt
from source by `vercel.json`'s `buildCommand`, so these files exist only to make
registry changes reviewable and to feed the drift gate.
