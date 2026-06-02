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
const HOMEPAGE = 'https://ds.interlace.tools';
const CHECK_ONLY = process.argv.includes('--check');

// Name of the registry:style item that every primitive depends on.
// Consumers install it once; `shadcn add` pulls it as a transitive dep when
// they add any primitive after the first.
const STYLE_ITEM = 'theme';

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
 *   5. interlace-theme.css  — brand violet palette (light + dark, AAA).
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

const collectRegistryDependencies = (source) => {
  const deps = new Set();
  for (const m of source.matchAll(RELATIVE_IMPORT_RE)) {
    const rel = m[1].replace(/^\.\//, '').replace(/\.js$|\.tsx?$/, '');
    if (rel.includes('/')) continue; // skip nested helpers
    if (rel === 'button-variants' || rel === 'cn') continue; // packaged with primitive
    deps.add(rel);
  }
  return [...deps].sort();
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
 *   `./<sibling>.js`                  → `@/components/ui/<sibling>`
 */
const rewriteImportsForConsumer = (source) =>
  source
    .replace(/from\s+(['"])\.\.\/lib\/cn\.js\1/g, 'from $1@/lib/utils$1')
    .replace(
      /from\s+(['"])\.\.\/lib\/(use-[\w-]+)\.js\1/g,
      'from $1@/hooks/$2$1',
    )
    .replace(
      /from\s+(['"])\.\/([\w-]+)\.js\1/g,
      'from $1@/components/ui/$2$1',
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
  // Every primitive depends on the shared theme item so consumers get the
  // brand tokens + animation keyframes installed alongside the .tsx.
  const registryDependencies = [STYLE_ITEM, ...collectRegistryDependencies(source)];
  // Decorative tiers (magicui / aceternity / patterns) nest under their
  // subdir in the consumer tree to preserve provenance. Primitives stay flat.
  const subdir = tier ? `${tier}/` : '';
  const tierLabel = tier ? ` (${tier})` : '';
  const item = {
    $schema: 'https://ui.shadcn.com/schema/registry-item.json',
    name,
    type: 'registry:ui',
    title: name.replace(/(^|-)([a-z])/g, (_, dash, c) =>
      dash ? ' ' + c.toUpperCase() : c.toUpperCase(),
    ),
    description: `@interlace/ui — ${name}${tierLabel} (shadcn-compatible).`,
    dependencies: collectDependencies(source),
    registryDependencies,
    files: [
      {
        path: `registry/interlace-ui/${subdir}${name}.tsx`,
        target: `components/ui/${subdir}${name}.tsx`,
        type: 'registry:ui',
        content: rewriteImportsForConsumer(source),
      },
    ],
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
  };
};

// ─── Starter-pack registry items ─────────────────────────────────────────────

const buildStarterItem = (entry) => ({
  $schema: 'https://ui.shadcn.com/schema/registry-item.json',
  name: entry.name,
  type: 'registry:ui',
  title: entry.title,
  description: entry.description,
  dependencies: [],
  registryDependencies: entry.registryDependencies,
  files: [
    {
      path: `registry/interlace-ui/starters/${entry.name}.md`,
      target: entry.target,
      type: 'registry:file',
      content: entry.body,
    },
  ],
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
    dependencies: ['tw-animate-css'],
    registryDependencies: [],
    files,
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

const compareItemAgainstDisk = async (built, errors) => {
  const outPath = path.join(OUT_DIR, `${built.name}.json`);
  try {
    const current = JSON.parse(await readFile(outPath, 'utf8'));
    if (JSON.stringify(current) !== JSON.stringify(built)) {
      errors.push(`drift: ${built.name}`);
    }
  } catch {
    errors.push(`missing: ${built.name}`);
  }
};

const writeItem = async (item, index) => {
  await writeFile(
    path.join(OUT_DIR, `${item.name}.json`),
    JSON.stringify(item, null, 2) + '\n',
    'utf8',
  );
  index.items.push({
    name: item.name,
    type: item.type,
    title: item.title,
    description: item.description,
  });
};

const main = async () => {
  await stat(PRIMITIVES_DIR);
  const files = (await readdir(PRIMITIVES_DIR))
    .filter((f) => f.endsWith('.tsx'))
    .sort();

  if (CHECK_ONLY) {
    const errors = [];
    const styleBuilt = await buildStyleItem();
    await compareItemAgainstDisk(styleBuilt, errors);
    errors.push(...(await checkRawStyleFiles()));
    for (const file of files) {
      const built = await buildItem(path.join(PRIMITIVES_DIR, file), file);
      await compareItemAgainstDisk(built, errors);
    }
    for (const entry of LIB_FILES) {
      const built = await buildLibItem(entry);
      await compareItemAgainstDisk(built, errors);
    }
    for (const entry of STARTER_BUNDLES) {
      const built = buildStarterItem(entry);
      await compareItemAgainstDisk(built, errors);
    }
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
        const built = await buildItem(path.join(dir, file), file, tier);
        await compareItemAgainstDisk(built, errors);
      }
    }
    if (errors.length) {
      console.error('Registry drift detected:\n  ' + errors.join('\n  '));
      process.exit(1);
    }
    console.log(
      `OK — ${files.length} primitive(s) + ${decorativeCount} decorative + 1 style + ${STYLE_FILES.length} raw stylesheet(s) + ${LIB_FILES.length} lib + ${STARTER_BUNDLES.length} starter(s) match on-disk.`,
    );
    return;
  }

  await mkdir(OUT_DIR, { recursive: true });
  const index = {
    $schema: 'https://ui.shadcn.com/schema/registry.json',
    name: 'interlace-ui',
    homepage: HOMEPAGE,
    items: [],
  };

  // Theme/style item first so it appears at the top of `index.json`.
  await writeItem(await buildStyleItem(), index);
  await writeRawStyleFiles();

  // Starter bundles next — most-prominent install surface for new consumers.
  for (const entry of STARTER_BUNDLES) {
    await writeItem(buildStarterItem(entry), index);
  }

  // Lib utilities — needed for components to compile in the consumer tree.
  for (const entry of LIB_FILES) {
    await writeItem(await buildLibItem(entry), index);
  }

  // Per-primitive items (largest cohort, alphabetical).
  for (const file of files) {
    await writeItem(await buildItem(path.join(PRIMITIVES_DIR, file), file), index);
  }

  // Decorative tiers (magicui / aceternity / patterns) — own surface, vendored
  // from upstream registries and promoted under the @interlace namespace.
  let decorativeCount = 0;
  for (const { name: tier, dir } of DECORATIVE_DIRS) {
    let dirFiles = [];
    try {
      dirFiles = (await readdir(dir)).filter((f) => f.endsWith('.tsx')).sort();
    } catch {
      continue;
    }
    decorativeCount += dirFiles.length;
    for (const file of dirFiles) {
      await writeItem(await buildItem(path.join(dir, file), file, tier), index);
    }
  }

  await writeFile(
    path.join(OUT_DIR, 'index.json'),
    JSON.stringify(index, null, 2) + '\n',
    'utf8',
  );

  // Auto-regenerate the semantics catalogue JSON read by
  // apps/registry/src/app/semantics-catalog/page.tsx. Keeping it here
  // means the catalogue and the registry items stay in lock-step on
  // every `npm run prebuild` — no separate npm script to forget.
  try {
    const { spawnSync } = await import('node:child_process');
    const result = spawnSync(
      'node',
      [path.join(REGISTRY_ROOT, 'scripts/build-semantics-catalog.mjs')],
      { stdio: 'inherit' },
    );
    if (result.status !== 0) {
      console.error('semantics-catalog regeneration failed; continuing');
    }
  } catch (err) {
    console.error('semantics-catalog regeneration error (non-fatal):', err);
  }

  console.log(
    `Built ${files.length} primitive(s) + ${decorativeCount} decorative + 1 style + ${STYLE_FILES.length} raw stylesheet(s) + ${LIB_FILES.length} lib + ${STARTER_BUNDLES.length} starter(s) → ${OUT_DIR}`,
  );
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
