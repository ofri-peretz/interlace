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
import { fileURLToPath, pathToFileURL } from 'node:url';
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
  // Charts — the visualisation layer. Only the `.tsx` components become items;
  // their pure cores (`scale.ts`, `graph.ts`) ride along as COMPANIONS via
  // `splitRelativeImports`, exactly like the `*-variants.ts` cva files. That is
  // deliberate: `@interlace/scale` and `@interlace/graph` would be absurdly
  // generic names to occupy in a shared registry namespace, and neither file
  // renders anything a consumer would install on its own.
  { name: 'charts', dir: path.join(REPO_ROOT, 'packages/ui/src/charts') },
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
 * Per-component versions (phase 9.2).
 *
 * `component-versions.json` is DERIVED from git history by
 * `scripts/derive-component-versions.mjs` — but it is a COMMITTED artefact,
 * and this generator reads the artefact rather than shelling out to git.
 *
 * That indirection is the whole trick. If the version were computed from
 * `git HEAD` at build time, every commit would change every item's
 * `meta.version` and the drift gate (`--check`, which diffs the built items
 * against `public/r/*.json`) would fail on the commit that introduced it and
 * on every commit after. Reading a committed manifest makes this build a pure
 * function of tracked files again: the JSON changes when the manifest
 * changes, and the manifest changes when someone runs `npm run
 * versions:derive` — which the release workflow does, in the same commit that
 * rebuilds the registry.
 *
 * See `docs/philosophies/VERSIONING_PHILOSOPHY.md` § "The drift gate".
 */
const VERSIONS_FILE = path.join(REGISTRY_ROOT, 'component-versions.json');
// Tolerant read: `derive-component-versions.mjs` imports this module to learn
// the item set, so on a fresh checkout with no manifest yet the two would
// deadlock. An absent manifest means "everything unversioned", which `--check`
// reports as an error rather than a crash.
const VERSION_DATA = JSON.parse(
  await readFile(VERSIONS_FILE, 'utf8').catch(() => '{"components":[]}'),
);
const VERSION_BY_NAME = new Map(
  VERSION_DATA.components.map((c) => [c.name, c]),
);
/** Items with no manifest entry — CI (`--check`) fails on these. */
const unversioned = [];

const versionInfoFor = (name) => {
  const entry = VERSION_BY_NAME.get(name);
  if (!entry) {
    unversioned.push(name);
    // `null` rather than a guessed version: a wrong version stamped into a
    // consumer's tree is worse than an absent one, and `--check` fails anyway.
    return { version: null, since: null };
  }
  return entry;
};

/**
 * The three version facts published on every item's `meta`:
 *   - `version`    — this component's own semver, bumped by its own history.
 *   - `since`      — the @interlace/ui release it first shipped in.
 *   - `deprecated` — present only when the manifest declares it.
 */
const versionMetaFor = (name) => {
  const info = versionInfoFor(name);
  return {
    version: info.version,
    since: info.since,
    ...(info.deprecated ? { deprecated: info.deprecated } : {}),
  };
};

/**
 * Source paths (repo-root-relative) that each item is built from, collected
 * during the build and exported for `derive-component-versions.mjs`.
 *
 * Deriving versions means knowing which files constitute a component — its
 * own file plus its companions (`button-variants.ts`, `scale.ts`, the
 * optional `<name>.meta.json`). That knowledge already lives here; a second
 * copy in the derive script would rot the first time a companion convention
 * changes, so the derive script imports this map instead.
 */
export const SOURCE_PATHS = new Map();

const relToRepo = (abs) => path.relative(REPO_ROOT, abs).split(path.sep).join('/');

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
/**
 * `'use client'` must be the first statement in the file, but may be preceded
 * by comments. A regex over the comment prefix nests quantifiers and
 * backtracks exponentially on `*//*` repetitions (CodeQL js/redos), so strip
 * leading comments/whitespace with a single linear pass instead.
 */
const firstStatementIndex = (source) => {
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
      i += 1;
    } else if (source.startsWith('/*', i)) {
      const end = source.indexOf('*/', i + 2);
      if (end === -1) return -1; // unterminated comment — no statement follows
      i = end + 2;
    } else if (source.startsWith('//', i)) {
      const end = source.indexOf('\n', i + 2);
      if (end === -1) return -1;
      i = end + 1;
    } else {
      break;
    }
  }
  return i;
};

export const hasUseClient = (source) => {
  const i = firstStatementIndex(source);
  return i !== -1 && /^['"]use client['"]/.test(source.slice(i));
};

/** `loading?: boolean` — the DS-wide skeleton-placeholder opt-in. */
const LOADING_PROP_RE = /^\s*loading\?:\s*boolean/m;

const metaFor = (source, tier, name) => {
  const mv = source.match(MIN_VIEWPORT_RE);
  return {
    tier: CATEGORY_DATA.tierOf[tier] ?? tier,
    client: hasUseClient(source),
    minViewport: mv ? Number.parseInt(mv[1], 10) : null,
    loading: LOADING_PROP_RE.test(source),
    ...versionMetaFor(name),
  };
};

// ─── Version banner stamped into the consumer's copy ─────────────────────────

/**
 * Index just past the leading `'use client'` statement, or 0 when the file has
 * none. Comments before the directive are legal and common (our sources put a
 * JSDoc header there), so the scan is the same linear one `hasUseClient` uses.
 */
const afterDirective = (source) => {
  if (!hasUseClient(source)) return 0;
  const eol = source.indexOf('\n', firstStatementIndex(source));
  return eol === -1 ? source.length : eol + 1;
};

/**
 * Stamp the component's version into the file the consumer ends up owning.
 *
 * `shadcn add` COPIES this content into their tree, at which point our git
 * history and their file are unrelated forever — so the only place a version
 * can live for them is inside the file itself. This banner is the prerequisite
 * for any "what changed since I installed" diff (phase 9.5): without it there
 * is nothing to diff against.
 *
 * Placed AFTER `'use client'` rather than before it. Comments before the
 * directive are legal, but "the directive must be first" is a rule with a long
 * history of bundlers enforcing it inconsistently, and there is no upside to
 * finding out which one the consumer uses.
 *
 * Line comments, not JSDoc: `src/lib/component-metadata.ts` parses the source's
 * JSDoc header for the Anatomy section and the R-rule table, and a second
 * JSDoc block at the top of the file is an invitation for that parser — and
 * every consumer's IDE — to attribute our banner to their component.
 */
const stampVersionBanner = (content, name, version) => {
  if (!version) return content;
  const banner =
    [
      `// @interlace/${name} v${version} — Interlace design system.`,
      `// Docs, props and live preview: ${HOMEPAGE}/c/${name}`,
      `// What changed since: ${HOMEPAGE}/c/${name}#history`,
      `// Generated banner — keep it, the upgrade diff reads this version.`,
    ].join('\n') + '\n';
  const cut = afterDirective(content);
  const rest = content.slice(cut);
  // A blank line after the banner unless the source already opens with one —
  // without it the banner runs straight into the component's own leading
  // comment and reads as one block.
  const gap = rest.startsWith('\n') ? '' : '\n';
  return content.slice(0, cut) + banner + gap + rest;
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
  // Alternate brand themes (phase 8.2). Shipping them with `@interlace/theme`
  // rather than as separate items is deliberate: a theme file is inert on its
  // own — it only overrides `--interlace-*` inside `@layer interlace.brand`,
  // which the baseline declares. Installing one without the baseline would
  // resolve to nothing, so they are one contract, not two.
  'themes/harbor.css',
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
  // Phase 8.3. These three are what `theme-switcher.tsx` imports, so without
  // them the switcher installs with dangling relative imports — which is
  // exactly what `assertRegistryContract` reported.
  {
    name: 'theme-tokens',
    sourceFile: 'theme-tokens.ts',
    target: 'lib/theme-tokens.ts',
    title: 'Theme token manifest',
    description:
      '@interlace/ui — the registry of themes and the list of every `--interlace-*` token a theme must define. A missing token does not throw; it silently inherits the previous theme\'s value.',
  },
  {
    name: 'use-theme',
    sourceFile: 'use-theme.ts',
    target: 'hooks/use-theme.ts',
    title: 'useTheme hook',
    description:
      '@interlace/ui — reads and writes the theme (`data-theme`) and colour scheme (`.dark`) axes, persists to localStorage, and follows the OS when no preference is stored.',
  },
  {
    name: 'theme-script',
    sourceFile: 'theme-script.ts',
    target: 'lib/theme-script.ts',
    title: 'No-flash theme bootstrap script',
    description:
      '@interlace/ui — the inline `<head>` script that applies the stored theme before first paint. Without it every page load flashes the default theme.',
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
  charts: 'charts/',
  templates: 'templates/',
  magicui: 'magicui/',
  aceternity: 'aceternity/',
};

/**
 * Strip comments before scanning for imports.
 *
 * Every primitive documents itself with a usage example in its header block,
 * and those examples import from `@interlace/ui/<entry>` — the package name a
 * CONSUMER of the library would write. Scanning the printed source counted
 * those as real imports, so `theme-script` shipped
 * `"dependencies": ["@interlace/ui"]` and `shadcn add` ran
 * `npm install @interlace/ui`, which 404s: the package is `private: true` and
 * has never been published. The CLI installs the whole batch in one npm call,
 * so that single comment made ALL 132 items uninstallable.
 *
 * Line comments are only stripped at line start, so a `https://` inside a
 * string literal survives.
 */
const stripComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

/**
 * The workspace's own package. It is `private: true`, so it can never be a
 * valid npm dependency of an installed item — registry items ship the SOURCE
 * of this package, they do not depend on it. Belt to `stripComments`'s braces:
 * a real (non-comment) self-import would otherwise break every install again.
 */
const PRIVATE_WORKSPACE_PKG = '@interlace/ui';

const collectDependencies = (source) => {
  const deps = new Set();
  for (const m of stripComments(source).matchAll(NPM_IMPORT_RE)) {
    const pkg = m[1].startsWith('@')
      ? m[1].split('/').slice(0, 2).join('/')
      : m[1].split('/')[0];
    if (pkg === 'react' || pkg === 'react-dom') continue;
    if (pkg === PRIVATE_WORKSPACE_PKG || pkg.startsWith(`${PRIVATE_WORKSPACE_PKG}/`))
      continue;
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
    // Driven by LIB_FILES, not by a `cn` arm plus a `use-*` pattern: a new
    // utility added to LIB_FILES is rewritten automatically. Anything under
    // `../lib/` that ISN'T a declared lib item survives unrewritten — and
    // `assertNoRelativeImports` below turns that into a build failure rather
    // than a broken consumer tree.
    .replace(
      /from\s+(['"])\.\.\/lib\/([\w-]+)\.js\1/g,
      (match, q, name) => {
        const entry = LIB_FILES.find((f) => f.name === name);
        return entry
          ? `from ${q}@/${entry.target.replace(/\.tsx?$/, '')}${q}`
          : match;
      },
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
  const metaPath = filePath.replace(/\.tsx?$/, '.meta.json');
  try {
    return JSON.parse(await readFile(metaPath, 'utf8'));
  } catch {
    return null;
  }
};

const buildItem = async (filePath, fileName, tier = null) => {
  const source = await readFile(filePath, 'utf8');
  const name = fileName.replace(/\.tsx?$/, '');
  // `.ts` covers the `*-variants.ts` cva companions that button.tsx and
  // skeleton.tsx import; a .tsx-only scan left them unpublished, so both
  // primitives shipped importing a file no registry item provided.
  const ext = fileName.endsWith('.tsx') ? '.tsx' : '.ts';
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
  const target = `components/ui/${subdir}${name}${ext}`;
  // Templates are full-page surfaces, not single components — `registry:block`
  // is the spec's type for those. Every file carries an explicit `target`, so
  // the type only changes how the item is classified, never where it lands.
  const itemType = tier === 'templates' ? 'registry:block' : 'registry:ui';
  const { version } = versionInfoFor(name);
  SOURCE_PATHS.set(name, [
    relToRepo(filePath),
    ...companions.map((c) => relToRepo(path.join(sourceDir, `${c}.ts`))),
    ...(meta ? [relToRepo(filePath.replace(/\.tsx?$/, '.meta.json'))] : []),
  ]);
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
        path: `registry/interlace-ui/${subdir}${name}${ext}`,
        target,
        type: itemType,
        // Banner on the item's own file only — a companion is an
        // implementation detail of this item, and four banners in one install
        // is noise the consumer has to read past every time they open it.
        content: stampVersionBanner(
          rewriteImportsForConsumer(source, subdir),
          name,
          version,
        ),
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
    meta: metaFor(source, tier ?? 'primitives', name),
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

/**
 * Consumer-side alias for a lib item, e.g. `theme-tokens` → `@/lib/theme-tokens`.
 * Built from the LIB_FILES targets so it can never disagree with where the file
 * is actually written.
 */
const LIB_ALIAS = new Map(
  LIB_FILES.map((e) => [
    e.sourceFile.replace(/\.ts$/, ''),
    `@/${e.target.replace(/\.ts$/, '')}`,
  ]),
);

/**
 * Rewrite lib→lib relative imports to their consumer aliases.
 *
 * `cn` and `use-reduced-motion` are standalone, so this case did not exist
 * until the theme trio landed: `use-theme` imports `./theme-tokens.js` and
 * `./theme-script.js`, and those two land in DIFFERENT consumer directories
 * (`hooks/` vs `lib/`), so a relative specifier cannot survive the copy.
 * Left alone it installs a file importing a sibling that isn't there —
 * caught by `assertRegistryContract`, which is why it is a build error and
 * not a support ticket.
 */
const rewriteLibImports = (source) =>
  source.replace(/from\s+['"]\.\/([\w-]+)\.js['"]/g, (match, name) => {
    const alias = LIB_ALIAS.get(name);
    return alias ? `from '${alias}'` : match;
  });

const buildLibItem = async (entry) => {
  const sourcePath = path.join(LIB_DIR, entry.sourceFile);
  const rawSource = await readFile(sourcePath, 'utf8');
  const source = rewriteLibImports(rawSource);
  SOURCE_PATHS.set(entry.name, [relToRepo(sourcePath)]);
  return {
    $schema: 'https://ui.shadcn.com/schema/registry-item.json',
    name: entry.name,
    type: 'registry:lib',
    title: entry.title,
    description: entry.description,
    author: AUTHOR,
    categories: categoriesFor(entry.name, 'util'),
    dependencies: collectDependencies(source),
    // Sibling lib items this one imports — without these, installing
    // `use-theme` alone leaves two unresolvable aliases in the consumer tree.
    registryDependencies: [...rawSource.matchAll(/from\s+['"]\.\/([\w-]+)\.js['"]/g)]
      .map((m) => m[1])
      .filter((name) => LIB_ALIAS.has(name))
      .map(itemRef),
    files: [
      {
        path: `registry/interlace-ui/lib/${entry.sourceFile}`,
        target: entry.target,
        type: 'registry:lib',
        content: stampVersionBanner(
          source,
          entry.name,
          versionInfoFor(entry.name).version,
        ),
      },
    ],
    meta: metaFor(source, 'util', entry.name),
    docs: docsFor(entry.name, entry.target, { requiresTheme: false }),
  };
};

// ─── Starter-pack registry items ─────────────────────────────────────────────

const buildStarterItem = (entry) => {
  // A starter has no component source — its content is authored right here, so
  // this generator IS its source file for version-derivation purposes.
  SOURCE_PATHS.set(entry.name, ['apps/registry/scripts/build-registry.mjs']);
  return starterItem(entry);
};

const starterItem = (entry) => ({
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
  meta: {
    tier: 'starter',
    client: false,
    minViewport: null,
    loading: false,
    ...versionMetaFor(entry.name),
  },
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
  SOURCE_PATHS.set(
    STYLE_ITEM,
    STYLE_FILES.map((f) => `packages/ui/styles/${f}`),
  );
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
    meta: {
      tier: 'theme',
      client: false,
      minViewport: null,
      loading: false,
      ...versionMetaFor(STYLE_ITEM),
    },
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

/**
 * `public/data/story-map.json` must match what the story sources say TODAY.
 *
 * It is regenerated on every full build but was never compared in `--check`,
 * so it rotted silently: the committed copy was two components behind HEAD,
 * and those two component pages shipped with no live preview at all while
 * every gate stayed green. A stale preview map is invisible by construction —
 * the page just renders the "no embeddable story" fallback.
 */
const checkStoryMap = async () => {
  const { buildStoryMap } = await import('./build-story-map.mjs');
  const { map } = await buildStoryMap();
  const file = path.join(REGISTRY_ROOT, 'public/data/story-map.json');
  try {
    const current = JSON.parse(await readFile(file, 'utf8'));
    return JSON.stringify(current) === JSON.stringify(map)
      ? []
      : ['drift: public/data/story-map.json (run `npm run registry:build`)'];
  } catch {
    return ['missing: public/data/story-map.json'];
  }
};

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
export const buildAll = async () => {
  await stat(PRIMITIVES_DIR);
  const primitiveFiles = (await readdir(PRIMITIVES_DIR))
    .filter((f) => f.endsWith('.tsx') || f.endsWith('.ts'))
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

/**
 * Assert the installability contract on the built item set.
 *
 * Schema validity is not enough: every item can be well-formed and still
 * uninstallable. The three ways that happens:
 *
 *   1. a BARE `registryDependencies` entry resolves against shadcn's registry,
 *      not ours (404, or worse — silently installs THEIR component);
 *   2. a relative import survives into `content`, pointing at a path that does
 *      not exist in a consumer tree;
 *   3. a dependency or `@/components/ui/*` import names an item we never ship.
 *
 * Runs on every build and in `--check` (CI), so none of the three can regress.
 */
const assertRegistryContract = (items) => {
  const names = new Set(items.map((i) => i.name));
  const errors = [];
  for (const item of items) {
    for (const dep of item.registryDependencies ?? []) {
      if (!dep.startsWith('http')) {
        errors.push(`${item.name}: bare registryDependency "${dep}" — must be a URL`);
        continue;
      }
      const target = dep.split('/').pop().replace(/\.json$/, '');
      if (!names.has(target)) {
        errors.push(`${item.name}: registryDependency "${dep}" names no item`);
      }
    }
    // Targets this item writes itself. A companion (`scale.ts` under charts/,
    // the `*-variants.ts` cva files) is shipped INSIDE its parent item's
    // `files[]`, so an import of it resolves in the consumer tree even though
    // no separate registry item is named after it. Checking only `names` here
    // reported those as dangling — a false failure that would have been "fixed"
    // by publishing `@interlace/scale`, occupying an absurdly generic name in a
    // shared namespace for a file nobody installs on its own.
    const ownTargets = new Set((item.files ?? []).map((f) => f.target));
    for (const file of item.files ?? []) {
      for (const [, spec] of (file.content ?? '').matchAll(
        /from\s+['"]([^'"]+)['"]/g,
      )) {
        if (spec.startsWith('.')) {
          errors.push(`${item.name}: relative import "${spec}" in ${file.target}`);
        } else if (spec.startsWith('@/components/ui/')) {
          const bare = spec.replace(/^@\//, '');
          const shipsItself =
            ownTargets.has(`${bare}.ts`) || ownTargets.has(`${bare}.tsx`);
          if (!shipsItself && !names.has(spec.split('/').pop())) {
            errors.push(`${item.name}: import "${spec}" names no item`);
          }
        }
      }
    }
  }
  return errors;
};

const summary = (built) =>
  `${built.primitiveCount} primitive(s) + ${built.decorativeCount} decorative + 1 style + ${STYLE_FILES.length} raw stylesheet(s) + ${LIB_FILES.length} lib + ${STARTER_BUNDLES.length} starter(s)`;

const main = async () => {
  const built = await buildAll();

  if (CHECK_ONLY) {
    const errors = [];
    for (const item of built.items) await compareItemAgainstDisk(item, errors);
    await compareAgainstDisk('index.json', built.index, errors);
    await compareAgainstDisk('registry.json', built.index, errors);
    errors.push(...assertRegistryContract(built.items));
    errors.push(...(await checkRawStyleFiles()));
    errors.push(...(await checkStoryMap()));
    // Every shipped item must carry an explicit intent category — an "Other"
    // bucket on a public registry is a browse dead-end. Local builds only warn
    // (so adding a component never blocks); CI fails.
    if (uncategorised.length) {
      errors.push(
        `uncategorised in registry-categories.json: ${[...new Set(uncategorised)].sort().join(', ')}`,
      );
    }
    // A new component with no manifest entry would ship with `version: null`
    // in `meta` and no banner in the consumer's file — i.e. silently outside
    // the versioning contract. Deterministic under any HEAD: this compares the
    // item set against the committed manifest, it does not consult git.
    if (unversioned.length) {
      errors.push(
        `missing from component-versions.json (run \`npm run versions:derive\`): ${[...new Set(unversioned)].sort().join(', ')}`,
      );
    }
    if (errors.length) {
      console.error('Registry drift detected:\n  ' + errors.join('\n  '));
      process.exit(1);
    }
    console.log(`OK — ${summary(built)} match on-disk.`);
    return;
  }

  const contractErrors = assertRegistryContract(built.items);
  if (contractErrors.length) {
    console.error(
      'Registry contract violated — these items are not installable:\n  ' +
        contractErrors.join('\n  '),
    );
    process.exit(1);
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
  const indexJson = JSON.stringify(built.index, null, 2) + '\n';
  // `registry.json` is the filename the shadcn CLI resolves for `list`/`search`,
  // and the shadcn registry directory requires it at the registry root: "a flat
  // registry ... `/registry.json` and `/component-name.json` files are expected
  // to be in the root". `index.json` stays as the alias src/lib/registry.ts reads.
  await writeFile(path.join(OUT_DIR, 'registry.json'), indexJson, 'utf8');
  await writeFile(path.join(OUT_DIR, 'index.json'), indexJson, 'utf8');

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
      // Compiles CHANGELOG.md + the pending changesets into the JSON that
      // /changelog and every component's History section read. Runs here so
      // the release notes can never describe a registry that no longer
      // matches — one command rebuilds both.
      'scripts/build-changelog.mjs',
      // Regenerates llms.txt, /.well-known/agent-skills/ and the two indexes
      // (agent-index.json for machines, search-index.json for the site's own
      // search). Runs LAST because it reads the `public/r/*.json` this build
      // just wrote — an agent-facing description of a registry that no longer
      // exists is worse than none, and a hand-maintained llms.txt is wrong the
      // day someone adds a component.
      'scripts/build-agent-surface.mjs',
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

  // Same shape as the categorisation warning above: a local build never blocks
  // on a component you are still writing, but it says out loud that the item
  // just shipped with `version: null` and no banner in the consumer's file.
  if (unversioned.length) {
    console.warn(
      `WARNING — ${new Set(unversioned).size} item(s) have no entry in component-versions.json, so they ship unversioned and unbannered: ` +
        [...new Set(unversioned)].sort().join(', ') +
        '\n  Run `npm run versions:derive` then rebuild. CI (`--check`) fails on this.',
    );
  }

  console.log(`Built ${summary(built)} → ${OUT_DIR}`);
};

// Only build when run as a script — importing this module (e.g. to unit-test
// `hasUseClient`) must not kick off a full registry build.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
