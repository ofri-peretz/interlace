#!/usr/bin/env node
/**
 * Build a shadcn-compatible registry from @interlace/ui sources.
 *
 * Output: `apps/registry/public/r/<name>.json` per the shadcn registry-item
 * schema (https://ui.shadcn.com/schema/registry-item.json). Plus an
 * `index.json` listing every available item.
 *
 * Item types emitted:
 *
 *   - `registry:ui`     — per primitive (`packages/ui/src/primitives/*.tsx`)
 *                       — plus three "starter bundle" composite items
 *                         (`a11y-starter`, `layout-starter`, `mdx-starter`).
 *   - `registry:style`  — the `theme` bundle: ALL five DS stylesheets
 *                         (tokens, foundation, preflight, theme,
 *                         interlace-theme) so a consumer who runs
 *                         `npx shadcn add @interlace/theme` gets the full
 *                         DS baseline — including the WCAG 2.2 SC 2.4.13
 *                         focus ring, the `[data-min-viewport]` container
 *                         contract, and the type / spacing / radius scales.
 *   - `registry:lib`    — utilities under `packages/ui/src/lib/*.ts` exposed
 *                         to consumers: `cn` → `@/lib/utils.ts`,
 *                         `use-reduced-motion` → `@/hooks/use-reduced-motion.ts`.
 *
 * Consumer usage (when deployed):
 *
 *   npx shadcn add https://ds.interlace.tools/r/button.json
 *   npx shadcn add @interlace/theme            # full CSS contract
 *   npx shadcn add @interlace/a11y-starter     # SkipLink+VisuallyHidden+FocusRing+useReducedMotion
 *   npx shadcn add @interlace/layout-starter   # Container+Section+Stack+Grid+Box+Typography
 *   npx shadcn add @interlace/mdx-starter      # mdx-components.tsx defaults
 *
 * Run with `--check` to validate without writing (used by CI drift check).
 */

import { readFile, readdir, writeFile, mkdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { AUTHOR, HOMEPAGE, itemRef } from '../registry.config.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REGISTRY_ROOT = path.resolve(SCRIPT_DIR, '..');
const REPO_ROOT = path.resolve(REGISTRY_ROOT, '..', '..');
const PRIMITIVES_DIR = path.join(REPO_ROOT, 'packages/ui/src/primitives');
const LIB_DIR = path.join(REPO_ROOT, 'packages/ui/src/lib');
const STYLES_DIR = path.join(REPO_ROOT, 'packages/ui/styles');

/**
 * Decorative-tier directories whose components ALSO ship as `registry:ui`
 * items. Walked the same way as PRIMITIVES_DIR; each .tsx becomes one
 * registry item that consumers install via
 * `npx shadcn add @interlace/<name>`. The target path matches the source
 * shape (consumer gets `components/ui/magicui/<name>.tsx` etc.) so the
 * three tiers stay distinguishable in the consumer's tree.
 *
 * Why these are ours, not external: we own the source under
 * `packages/ui/src/{magicui,aceternity,patterns}/`. The `components.json`
 * registries map used to include `@magicui` / `@aceternity` aliases pointing
 * at upstream registries — but every component we use was already vendored
 * into our package. Pointing the registry map at our own surface promotes
 * @interlace as the single canonical install surface (per the user's
 * "promote usage + reusability of our components" directive).
 */
const DECORATIVE_DIRS = [
  { name: 'magicui', dir: path.join(REPO_ROOT, 'packages/ui/src/magicui') },
  { name: 'aceternity', dir: path.join(REPO_ROOT, 'packages/ui/src/aceternity') },
  { name: 'patterns', dir: path.join(REPO_ROOT, 'packages/ui/src/patterns') },
  // Phase 4 of the 5-layer architecture — templates are full-page
  // surfaces that compose patterns + primitives inside SectionBoundaries.
  // They ship as registry items so consumers can
  // `npx shadcn add @interlace/article-template`. Tier label is
  // `templates`; install target lands at `components/ui/templates/`.
  { name: 'templates', dir: path.join(REPO_ROOT, 'packages/ui/src/templates') },
  // NOTE: `blocks` is INTENTIONALLY not scanned — Phase 1 of the
  // 5-layer architecture renamed `packages/ui/src/blocks/*.tsx` to
  // `packages/ui/src/patterns/*.tsx`. The old `blocks/` paths still
  // exist as one-line `export * from '../patterns/<name>.js'` aliases
  // so `import from '@interlace/ui/blocks/<name>'` keeps working for
  // one release cycle. Scanning blocks/ here would double-publish each
  // pattern as both `r/<name>.json` (from patterns scan) and produce
  // a malformed dep list (the alias has no real imports, so deps drop
  // to []). Skip it.
];
const OUT_DIR = path.join(REGISTRY_ROOT, 'public/r');
const STYLES_OUT_DIR = path.join(OUT_DIR, 'styles');
const CHECK_ONLY = process.argv.includes('--check');

/**
 * Categorisation is data, not code — `registry-categories.json` is the single
 * source of truth shared by this generator (which stamps `categories` onto
 * every item, per the shadcn registry-item schema) and by the site's
 * `src/lib/categories.ts` (which only reads the titles/descriptions).
 */
const CATEGORY_DATA = JSON.parse(
  await readFile(path.join(REGISTRY_ROOT, 'registry-categories.json'), 'utf8'),
);
/** Names that fell through to the `other` bucket — CI (`--check`) fails on these. */
const uncategorised = [];

/**
 * shadcn `categories` is an array, so each item carries BOTH axes:
 *   - intent  ("what am I trying to do") — form / overlay / marketing / …
 *   - tier    ("which layer of the DS")  — primitive / pattern / template / …
 * The registry directory filters on the first; the site's nav uses both.
 */
const categoriesFor = (name, tier) => {
  const tierId = CATEGORY_DATA.tierOf[tier] ?? tier;
  const intent =
    CATEGORY_DATA.assignments[name] ??
    CATEGORY_DATA.tierDefaultCategory[tierId] ??
    'other';
  // Only a resolved `other` is a failure — a tier default (effects →
  // decorative) is a real category, not a dead-end.
  if (intent === 'other') uncategorised.push(name);
  return intent === tierId ? [intent] : [intent, tierId];
};

// `meta` is free-form per the schema. We publish the two contract facts a
// consumer can't get from the source without parsing it: the RSC boundary and
// the declared minimum viewport (DESIGN_PRINCIPLES #14).
const MIN_VIEWPORT_RE = /export\s+const\s+MIN_VIEWPORT\s*=\s*(\d+)/;
const USE_CLIENT_RE =
  /^\s*(?:\/\*[\s\S]*?\*\/\s*)*(?:\/\/[^\n]*\n\s*)*['"]use client['"]/m;

/** `loading?: boolean` — the DS-wide skeleton-placeholder opt-in. */
const LOADING_PROP_RE = /^\s*loading\?:\s*boolean/m;

const metaFor = (source, tier) => {
  const mv = source.match(MIN_VIEWPORT_RE);
  return {
    tier: CATEGORY_DATA.tierOf[tier] ?? tier,
    client: USE_CLIENT_RE.test(source),
    minViewport: mv ? Number.parseInt(mv[1], 10) : null,
    loading: LOADING_PROP_RE.test(source),
  };
};

/**
 * `docs` is printed by the shadcn CLI after a successful install. Keep it to
 * what a consumer needs in the terminal at that moment: where the file landed,
 * how to import it, and where the full contract lives.
 */
const docsFor = (name, target, { requiresTheme = true } = {}) =>
  [
    `## @interlace/${name}`,
    '',
    `Installed to \`${target}\`.`,
    '',
    `\`\`\`tsx\nimport { /* … */ } from '@/${target.replace(/\.tsx?$/, '')}';\n\`\`\``,
    '',
    `Props, a11y contract, live preview and source: ${HOMEPAGE}/c/${name}`,
    // Only true for items that actually declare `theme` as a dependency —
    // the lib utilities don't, so telling their installer otherwise is a lie
    // printed straight into their terminal.
    ...(requiresTheme
      ? [
          '',
          'Requires the `@interlace/theme` CSS baseline (installed automatically as a registry dependency).',
        ]
      : []),
  ].join('\n');

// Name of the registry:style item that every primitive depends on.
// Consumers install it once; `shadcn add` pulls it as a transitive dep when
// they add any primitive after the first.
const STYLE_ITEM = 'theme';

/**
 * Cross-registry references MUST be absolute URLs — `itemRef` above.
 *
 * Per the registry-item schema, a BARE name in `registryDependencies` means
 * "a shadcn/ui core component" — the CLI resolves it against ui.shadcn.com.
 * Emitting `["theme", "skeleton"]` therefore made every install die with
 * `The item at https://ui.shadcn.com/r/styles/<style>/theme.json was not
 * found`. Caught by `scripts/e2e-install.mjs`; see the results file.
 *
 * The `@interlace/<name>` alias form only resolves for consumers who have the
 * namespace configured in components.json, so it can't be used here either —
 * a raw-URL installer would break. The absolute URL works in both flows.
 */

/**
 * Stylesheet files copied verbatim from @interlace/ui/styles into the
 * registry's public dir so they live at stable URLs (CSS @imports + raw
 * fetch both work). Bundled into the `theme` registry:style item in this
 * order — the cascade matters:
 *
 *   1. tokens.css           — animation + motion tokens (keyframes etc.).
 *   2. foundation.css       — type scale, spacing scale, radius scale,
 *                             container widths, font tokens. The
 *                             structural floor every primitive depends on.
 *   3. preflight.css        — token-aware baseline beyond Tailwind preflight:
 *                             focus ring (WCAG 2.2 SC 2.4.13), selection,
 *                             scrollbar tint, smooth-scroll under
 *                             prefers-reduced-motion, tabular-nums, the
 *                             [data-min-viewport] container contract.
 *   4. theme.css            — shadcn↔fumadocs token bridge + Shiki AAA boosts.
 *   5. interlace-theme.css  — brand burnt-orange palette (light + dark, AAA).
 *
 * Before this commit, only 1/4/5 shipped — half of DESIGN_PRINCIPLES.md
 * was unreachable to consumers. See plan
 * `.claude/plans/majestic-humming-sloth.md` § A1.
 */
const STYLE_FILES = [
  'tokens.css',
  'foundation.css',
  'preflight.css',
  'theme.css',
  'interlace-theme.css',
];

/**
 * Library utilities exposed as `registry:lib` items so consumers can install
 * them via `npx shadcn add @interlace/<name>`. Each entry maps a `.ts` file
 * under `packages/ui/src/lib/` to a consumer-side path that matches the
 * canonical shadcn directory layout:
 *
 *   - `cn`                 → `@/lib/utils.ts`         (matches shadcn's default `cn`)
 *   - `use-reduced-motion` → `@/hooks/use-reduced-motion.ts`
 *
 * The shadcn CLI will write the file at `target`. Per-primitive registry
 * items reference these via the consumer-facing import paths the
 * `rewriteImportsForConsumer` step emits.
 */
const LIB_FILES = [
  {
    name: 'cn',
    sourceFile: 'cn.ts',
    target: 'lib/utils.ts',
    title: 'cn — class-name merge utility',
    description:
      '@interlace/ui — the cn() helper, alias-compatible with shadcn. Merges Tailwind class lists deterministically.',
  },
  {
    name: 'use-reduced-motion',
    sourceFile: 'use-reduced-motion.ts',
    target: 'hooks/use-reduced-motion.ts',
    title: 'useReducedMotion hook',
    description:
      '@interlace/ui — the `useReducedMotion` hook every interactive primitive uses to gate animations on the user\'s OS preference.',
  },
];

/**
 * Starter-pack registry:ui items. Each is a "meta-install" that pulls a
 * curated set of registry items via its `registryDependencies` — the
 * shadcn CLI walks the graph transitively. The `files` array carries a
 * single README so the schema's `files` requirement is satisfied and the
 * consumer ends up with documentation of what the bundle just installed.
 *
 * Pattern: package-per-tier (a11y, layout, mdx), not per-component — keeps
 * bundle maintenance bounded.
 */
const STARTER_BUNDLES = [
  {
    name: 'a11y-starter',
    title: 'A11y Starter',
    description:
      '@interlace/ui — the three a11y primitives + the reduced-motion hook every consumer should install on day one.',
    target: 'components/ui/INTERLACE-A11Y-STARTER.md',
    body: `# @interlace/a11y-starter\n\nInstalled:\n\n- \`SkipLink\` — focus-visible skip-to-main link.\n- \`VisuallyHidden\` — screen-reader-only span (component variant).\n- \`FocusRing\` — composable WCAG 2.2 SC 2.4.13 focus contract.\n- \`useReducedMotion\` — gates every animation in the DS.\n- \`theme\` — full DS CSS baseline.\n\nDocs: https://ds.interlace.tools/getting-started\n`,
    registryDependencies: [
      'skip-link',
      'visually-hidden',
      'focus-ring',
      'use-reduced-motion',
      STYLE_ITEM,
    ],
  },
  {
    name: 'layout-starter',
    title: 'Layout Starter',
    description:
      '@interlace/ui — the six layout primitives that compose every page. One install, the LAYOUT_PHILOSOPHY contract is satisfied.',
    target: 'components/ui/INTERLACE-LAYOUT-STARTER.md',
    body: `# @interlace/layout-starter\n\nInstalled:\n\n- \`Container\` — 4 width tiers (prose / content / wide / full).\n- \`Section\` — vertical-rhythm slabs.\n- \`Stack\` + \`Cluster\` — six-step gap scale.\n- \`Grid\` — responsive grid primitive.\n- \`Box\` — token-aware surface (background + padding + radius + border).\n- \`Typography\` — h1..h6, body, long, ui, ui-sm, caption, code variants.\n- \`theme\` — full DS CSS baseline.\n\nDocs: https://ds.interlace.tools/getting-started\n`,
    registryDependencies: [
      'container',
      'section',
      'stack',
      'grid',
      'box',
      'typography',
      STYLE_ITEM,
    ],
  },
  {
    name: 'mdx-starter',
    title: 'MDX Starter',
    description:
      '@interlace/ui — the components most MDX pipelines need (Callout, Prose, CodeBlock, Tag), wired through a default mdx-components.tsx.',
    target: 'components/ui/INTERLACE-MDX-STARTER.md',
    body: `# @interlace/mdx-starter\n\nInstalled:\n\n- \`Callout\` — info / warn / danger / success / note prose annotations.\n- \`Prose\` — typographic article-body wrapper.\n- \`CodeBlock\` — Shiki-rendered fenced code with copy button.\n- \`Tag\` + \`TagList\` — article tag badges.\n- \`Figure\` — image + caption + alt + AspectRatio.\n- \`theme\` — full DS CSS baseline.\n\nWire into your MDX pipeline by spreading the DS defaults into your\nmdx-components.tsx. See https://ds.interlace.tools/getting-started\n`,
    registryDependencies: [
      'callout',
      'prose',
      'code-block',
      'tag',
      'figure',
      STYLE_ITEM,
    ],
  },
];

// ─── Heuristic dependency extraction ─────────────────────────────────────────

const NPM_IMPORT_RE = /from\s+['"]([^.@/][^'"]*|@[^/]+\/[^'"]+)['"]/g;
const RELATIVE_IMPORT_RE = /from\s+['"](\.\/[^'"]+)['"]/g;
/** `../primitives/skeleton.js`, `../patterns/figure.js`, … */
const CROSS_TIER_IMPORT_RE = /from\s+['"]\.\.\/([\w-]+)\/([\w-]+)\.js['"]/g;

/**
 * Source directories under `packages/ui/src/` whose `.tsx` files are registry
 * items, mapped to the subdirectory they land in inside the consumer's
 * `components/ui/`. Primitives are flat; every other tier keeps its folder so
 * provenance survives the install.
 */
const TIER_SUBDIR = {
  primitives: '',
  patterns: 'patterns/',
  templates: 'templates/',
  magicui: 'magicui/',
  aceternity: 'aceternity/',
};

const collectDependencies = (source) => {
  const deps = new Set();
  for (const m of source.matchAll(NPM_IMPORT_RE)) {
    const pkg = m[1].startsWith('@')
      ? m[1].split('/').slice(0, 2).join('/')
      : m[1].split('/')[0];
    if (pkg === 'react' || pkg === 'react-dom') continue;
    deps.add(pkg);
  }
  return [...deps].sort();
};

/**
 * Split a source file's sibling imports (`./x.js`) into the two things they
 * can be:
 *
 *   - `deps`       — a sibling `.tsx`, i.e. another registry item. Becomes a
 *                    `registryDependency` so the CLI installs it too.
 *   - `companions` — a sibling `.ts` (e.g. `button-variants.ts`,
 *                    `skeleton-variants.ts`). NOT a registry item — it has to
 *                    ship inside this item's `files[]`, or the rewritten
 *                    `@/components/ui/<x>` import dangles in the consumer's
 *                    tree and the install won't compile.
 *
 * Resolved from disk rather than a hardcoded name list, so a new
 * `*-variants.ts` can never silently break an install again.
 */
const splitRelativeImports = async (source, sourceDir) => {
  const deps = new Set();
  const companions = new Set();
  for (const m of source.matchAll(RELATIVE_IMPORT_RE)) {
    const rel = m[1].replace(/^\.\//, '').replace(/\.js$|\.tsx?$/, '');
    if (rel.includes('/')) continue; // skip nested helpers
    if (await exists(path.join(sourceDir, `${rel}.tsx`))) {
      deps.add(rel);
    } else if (await exists(path.join(sourceDir, `${rel}.ts`))) {
      companions.add(rel);
    }
  }
  // Cross-tier imports (`../primitives/skeleton.js` from a pattern) are
  // registry dependencies too. Missing them meant installing a single pattern
  // left a dangling import in the consumer's tree — `next build` in
  // scripts/e2e-install.mjs is what surfaced it.
  for (const m of source.matchAll(CROSS_TIER_IMPORT_RE)) {
    const [, tierDir, dep] = m;
    if (!(tierDir in TIER_SUBDIR)) continue; // ../lib/* is handled separately
    deps.add(dep);
  }
  return {
    deps: [...deps].sort(),
    companions: [...companions].sort(),
  };
};

const exists = async (p) => {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
};

// ─── Consumer-side import rewriting ──────────────────────────────────────────

/**
 * Rewrite source-internal relative imports to consumer-facing shadcn aliases.
 *
 * The package source uses `../lib/cn.js` and `./button.js` because those resolve
 * inside `@interlace/ui` (compiled from `packages/ui/src/`). But `shadcn add`
 * writes the source verbatim into the consumer's `components/ui/<name>.tsx`,
 * where no `../lib/` or sibling `.js` exists. Consumers configure aliases in
 * `components.json` (`utils → @/lib/utils`, `ui → @/components/ui`) — rewrite
 * to those before embedding so the consumer's tree resolves out of the box.
 *
 * Mapping:
 *   `../lib/cn.js`                    → `@/lib/utils`
 *   `../lib/use-reduced-motion.js`    → `@/hooks/use-reduced-motion`
 *   `./<sibling>.js`                  → `@/components/ui/<subdir><sibling>`
 *   `../primitives/<x>.js`            → `@/components/ui/<x>`
 *   `../<tier>/<x>.js`                → `@/components/ui/<tier>/<x>`
 *
 * The cross-tier arm is what lets a pattern compose a primitive: without it
 * `import { Skeleton } from '../primitives/skeleton.js'` shipped verbatim and
 * failed to resolve in every consumer tree.
 */
const rewriteImportsForConsumer = (source, subdir = '') =>
  source
    .replace(/from\s+(['"])\.\.\/lib\/cn\.js\1/g, 'from $1@/lib/utils$1')
    .replace(
      /from\s+(['"])\.\.\/lib\/(use-[\w-]+)\.js\1/g,
      'from $1@/hooks/$2$1',
    )
    .replace(
      /from\s+(['"])\.\.\/([\w-]+)\/([\w-]+)\.js\1/g,
      (match, q, tierDir, name) =>
        tierDir in TIER_SUBDIR
          ? `from ${q}@/components/ui/${TIER_SUBDIR[tierDir]}${name}${q}`
          : match,
    )
    .replace(
      /from\s+(['"])\.\/([\w-]+)\.js\1/g,
      `from $1@/components/ui/${subdir}$2$1`,
    );

// ─── Per-primitive registry item ─────────────────────────────────────────────

const readOptionalMeta = async (filePath) => {
  const metaPath = filePath.replace(/\.tsx$/, '.meta.json');
  try {
    return JSON.parse(await readFile(metaPath, 'utf8'));
  } catch {
    return null;
  }
};

const buildItem = async (filePath, fileName, tier = null) => {
  const source = await readFile(filePath, 'utf8');
  const name = fileName.replace(/\.tsx$/, '');
  const meta = await readOptionalMeta(filePath);
  const sourceDir = path.dirname(filePath);
  const { deps, companions } = await splitRelativeImports(source, sourceDir);
  // Every primitive depends on the shared theme item so consumers get the
  // brand tokens + animation keyframes installed alongside the .tsx.
  const registryDependencies = [STYLE_ITEM, ...deps].map(itemRef);
  // Decorative tiers (magicui / aceternity / patterns) nest under their
  // subdir in the consumer tree to preserve provenance. Primitives stay flat.
  const subdir = TIER_SUBDIR[tier ?? 'primitives'] ?? '';
  const tierLabel = tier ? ` (${tier})` : '';
  const target = `components/ui/${subdir}${name}.tsx`;
  // Templates are full-page surfaces, not single components — `registry:block`
  // is the spec's type for those. Every file carries an explicit `target`, so
  // the type only changes how the item is classified, never where it lands.
  const itemType = tier === 'templates' ? 'registry:block' : 'registry:ui';
  const item = {
    $schema: 'https://ui.shadcn.com/schema/registry-item.json',
    name,
    type: itemType,
    title: name.replace(/(^|-)([a-z])/g, (_, dash, c) =>
      dash ? ' ' + c.toUpperCase() : c.toUpperCase(),
    ),
    description: `@interlace/ui — ${name}${tierLabel} (shadcn-compatible).`,
    author: AUTHOR,
    categories: categoriesFor(name, tier ?? 'primitives'),
    dependencies: collectDependencies(source),
    registryDependencies,
    files: [
      {
        path: `registry/interlace-ui/${subdir}${name}.tsx`,
        target,
        type: itemType,
        content: rewriteImportsForConsumer(source, subdir),
      },
      ...(await Promise.all(
        companions.map(async (companion) => ({
          path: `registry/interlace-ui/${subdir}${companion}.ts`,
          target: `components/ui/${subdir}${companion}.ts`,
          type: itemType,
          content: rewriteImportsForConsumer(
            await readFile(path.join(sourceDir, `${companion}.ts`), 'utf8'),
            subdir,
          ),
        })),
      )),
    ],
    meta: metaFor(source, tier ?? 'primitives'),
    docs: docsFor(name, target),
  };
  // Optional sibling `<name>.meta.json` adds shadcn-schema fields the source
  // file can't express on its own — cssVars (theme tokens), css (keyframes /
  // @theme entries). Used by primitives that depend on a CSS-side companion.
  if (meta?.cssVars) item.cssVars = meta.cssVars;
  if (meta?.css) item.css = meta.css;
  return item;
};

// ─── Library registry items (registry:lib) ───────────────────────────────────
//
// `cn` and `useReducedMotion` are utilities every interactive primitive
// imports. Before this commit they were not shippable via shadcn (the
// build script only walked primitives/) — consumers had to either rely
// on shadcn's default `cn` or vendor the hook manually. Now they're
// first-class registry items, target paths match shadcn defaults.

const buildLibItem = async (entry) => {
  const sourcePath = path.join(LIB_DIR, entry.sourceFile);
  const source = await readFile(sourcePath, 'utf8');
  return {
    $schema: 'https://ui.shadcn.com/schema/registry-item.json',
    name: entry.name,
    type: 'registry:lib',
    title: entry.title,
    description: entry.description,
    author: AUTHOR,
    categories: categoriesFor(entry.name, 'util'),
    dependencies: collectDependencies(source),
    registryDependencies: [],
    files: [
      {
        path: `registry/interlace-ui/lib/${entry.sourceFile}`,
        target: entry.target,
        type: 'registry:lib',
        content: source,
      },
    ],
    meta: metaFor(source, 'util'),
    docs: docsFor(entry.name, entry.target, { requiresTheme: false }),
  };
};

// ─── Starter-pack registry items ─────────────────────────────────────────────

const buildStarterItem = (entry) => ({
  $schema: 'https://ui.shadcn.com/schema/registry-item.json',
  name: entry.name,
  type: 'registry:ui',
  title: entry.title,
  description: entry.description,
  author: AUTHOR,
  categories: categoriesFor(entry.name, 'starter'),
  dependencies: [],
  registryDependencies: entry.registryDependencies.map(itemRef),
  files: [
    {
      path: `registry/interlace-ui/starters/${entry.name}.md`,
      target: entry.target,
      type: 'registry:file',
      content: entry.body,
    },
  ],
  meta: { tier: 'starter', client: false, minViewport: null, loading: false },
  docs: entry.body,
});

// ─── Theme / style registry item ─────────────────────────────────────────
//
// Publishes the five @interlace/ui stylesheets (tokens, foundation,
// preflight, theme, interlace-theme) as a single shadcn `registry:style`
// item so consumers get the full DS CSS baseline installed when they
// `npx shadcn add` any primitive — focus ring, min-viewport contract,
// type scale, spacing scale, radius scale, brand palette.
//
// The raw .css files are also copied to `public/r/styles/*.css` so
// consumers can pull them directly without the shadcn CLI (e.g. as plain
// `@import "https://ds.interlace.tools/r/styles/tokens.css"` URLs from
// their global stylesheet).

const buildStyleItem = async () => {
  const files = await Promise.all(
    STYLE_FILES.map(async (name) => {
      const content = await readFile(path.join(STYLES_DIR, name), 'utf8');
      return {
        path: `registry/interlace-ui/styles/${name}`,
        target: `styles/interlace/${name}`,
        type: 'registry:style',
        content,
      };
    }),
  );
  return {
    $schema: 'https://ui.shadcn.com/schema/registry-item.json',
    name: STYLE_ITEM,
    type: 'registry:style',
    title: 'Interlace Theme',
    description:
      '@interlace/ui — full DS CSS baseline: tokens, foundation (type/spacing/radius), preflight (focus ring + min-viewport contract), shadcn↔fumadocs bridge, and brand palette.',
    author: AUTHOR,
    categories: categoriesFor(STYLE_ITEM, 'theme'),
    dependencies: ['tw-animate-css'],
    registryDependencies: [],
    files,
    meta: { tier: 'theme', client: false, minViewport: null, loading: false },
    docs: [
      '## @interlace/theme',
      '',
      `Five stylesheets landed in \`styles/interlace/\`, in cascade order: ${STYLE_FILES.join(' → ')}.`,
      '',
      'Import them from your global stylesheet in exactly that order.',
      '',
      `Full contract: ${HOMEPAGE}/css-contract`,
    ].join('\n'),
  };
};

const writeRawStyleFiles = async () => {
  await mkdir(STYLES_OUT_DIR, { recursive: true });
  for (const name of STYLE_FILES) {
    const content = await readFile(path.join(STYLES_DIR, name), 'utf8');
    await writeFile(path.join(STYLES_OUT_DIR, name), content, 'utf8');
  }
};

const checkRawStyleFiles = async () => {
  const errors = [];
  for (const name of STYLE_FILES) {
    const sourcePath = path.join(STYLES_DIR, name);
    const outPath = path.join(STYLES_OUT_DIR, name);
    try {
      const source = await readFile(sourcePath, 'utf8');
      const current = await readFile(outPath, 'utf8');
      if (source !== current) errors.push(`drift: styles/${name}`);
    } catch {
      errors.push(`missing: styles/${name}`);
    }
  }
  return errors;
};

// ─── Main ────────────────────────────────────────────────────────────────────

const compareAgainstDisk = async (fileName, built, errors) => {
  try {
    const current = JSON.parse(
      await readFile(path.join(OUT_DIR, fileName), 'utf8'),
    );
    if (JSON.stringify(current) !== JSON.stringify(built)) {
      errors.push(`drift: ${fileName}`);
    }
  } catch {
    errors.push(`missing: ${fileName}`);
  }
};

const compareItemAgainstDisk = (built, errors) =>
  compareAgainstDisk(`${built.name}.json`, built, errors);

const indexEntry = (item) => ({
  name: item.name,
  type: item.type,
  title: item.title,
  description: item.description,
  categories: item.categories,
  meta: item.meta,
});

/**
 * Build every registry item in memory. Both `--check` and the real write go
 * through this, so the drift gate can never diverge from what gets written —
 * and `index.json` is covered by the same comparison as the items.
 */
const buildAll = async () => {
  await stat(PRIMITIVES_DIR);
  const primitiveFiles = (await readdir(PRIMITIVES_DIR))
    .filter((f) => f.endsWith('.tsx'))
    .sort();

  const items = [];
  // Theme/style item first so it appears at the top of `index.json`.
  items.push(await buildStyleItem());
  // Starter bundles next — most-prominent install surface for new consumers.
  for (const entry of STARTER_BUNDLES) items.push(buildStarterItem(entry));
  // Lib utilities — needed for components to compile in the consumer tree.
  for (const entry of LIB_FILES) items.push(await buildLibItem(entry));
  // Per-primitive items (largest cohort, alphabetical).
  for (const file of primitiveFiles) {
    items.push(await buildItem(path.join(PRIMITIVES_DIR, file), file));
  }

  // Decorative tiers (magicui / aceternity / patterns / templates) — our own
  // surface, promoted under the @interlace namespace.
  let decorativeCount = 0;
  for (const { name: tier, dir } of DECORATIVE_DIRS) {
    let dirFiles = [];
    try {
      dirFiles = (await readdir(dir)).filter((f) => f.endsWith('.tsx')).sort();
    } catch {
      continue; // tier dir not yet created — fine
    }
    decorativeCount += dirFiles.length;
    for (const file of dirFiles) {
      items.push(await buildItem(path.join(dir, file), file, tier));
    }
  }

  const index = {
    $schema: 'https://ui.shadcn.com/schema/registry.json',
    name: 'interlace-ui',
    homepage: HOMEPAGE,
    items: items.map(indexEntry),
  };

  return { items, index, primitiveCount: primitiveFiles.length, decorativeCount };
};

const summary = (built) =>
  `${built.primitiveCount} primitive(s) + ${built.decorativeCount} decorative + 1 style + ${STYLE_FILES.length} raw stylesheet(s) + ${LIB_FILES.length} lib + ${STARTER_BUNDLES.length} starter(s)`;

const main = async () => {
  const built = await buildAll();

  if (CHECK_ONLY) {
    const errors = [];
    for (const item of built.items) await compareItemAgainstDisk(item, errors);
    await compareAgainstDisk('index.json', built.index, errors);
    errors.push(...(await checkRawStyleFiles()));
    // Every shipped item must carry an explicit intent category — an "Other"
    // bucket on a public registry is a browse dead-end. Local builds only warn
    // (so adding a component never blocks); CI fails.
    if (uncategorised.length) {
      errors.push(
        `uncategorised in registry-categories.json: ${[...new Set(uncategorised)].sort().join(', ')}`,
      );
    }
    if (errors.length) {
      console.error('Registry drift detected:\n  ' + errors.join('\n  '));
      process.exit(1);
    }
    console.log(`OK — ${summary(built)} match on-disk.`);
    return;
  }

  await mkdir(OUT_DIR, { recursive: true });
  for (const item of built.items) {
    await writeFile(
      path.join(OUT_DIR, `${item.name}.json`),
      JSON.stringify(item, null, 2) + '\n',
      'utf8',
    );
  }
  await writeRawStyleFiles();
  await writeFile(
    path.join(OUT_DIR, 'index.json'),
    JSON.stringify(built.index, null, 2) + '\n',
    'utf8',
  );

  // Auto-regenerate the semantics catalogue JSON read by
  // apps/registry/src/app/semantics-catalog/page.tsx. Keeping it here
  // means the catalogue and the registry items stay in lock-step on
  // every `npm run prebuild` — no separate npm script to forget.
  try {
    const { spawnSync } = await import('node:child_process');
    for (const script of [
      'scripts/build-semantics-catalog.mjs',
      // Maps each item to its Storybook story ids, so component pages can
      // embed a live render instead of linking away.
      'scripts/build-story-map.mjs',
    ]) {
      const result = spawnSync('node', [path.join(REGISTRY_ROOT, script)], {
        stdio: 'inherit',
      });
      if (result.status !== 0) {
        console.error(`${script} regeneration failed; continuing`);
      }
    }
  } catch (err) {
    console.error('companion-catalogue regeneration error (non-fatal):', err);
  }

  if (uncategorised.length) {
    console.warn(
      `WARNING — ${new Set(uncategorised).size} item(s) have no entry in registry-categories.json and fell into "other": ` +
        [...new Set(uncategorised)].sort().join(', ') +
        '\n  CI (`--check`) fails on this. Add them to `assignments`.',
    );
  }

  console.log(`Built ${summary(built)} → ${OUT_DIR}`);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
