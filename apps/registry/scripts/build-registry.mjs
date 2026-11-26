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
 *   - `registry:style`  — `interlace-base` (the `base.css` barrel: brand,
 *                         semantics, structure; additive, every component
 *                         depends on it) and `interlace-foundation` (the
 *                         `index.css` barrel: base plus the opt-in page
 *                         layer). See STYLE_ITEMS.
 *   - `registry:theme`  — `theme`: shadcn cssVars pointing the host's own
 *                         `--primary` etc. at Interlace's brand tokens.
 *   - `registry:lib`    — utilities under `packages/ui/src/lib/*.ts` exposed
 *                         to consumers: `cn` → `@/lib/utils.ts`,
 *                         `use-reduced-motion` → `@/hooks/use-reduced-motion.ts`.
 *
 * Consumer usage (when deployed):
 *
 *   npx shadcn add https://ds.interlace.tools/r/button.json
 *   npx shadcn add @interlace/theme            # the Interlace palette (cssVars)
 *   npx shadcn add @interlace/interlace-foundation  # fonts + page preflight
 *   npx shadcn add @interlace/a11y-starter     # SkipLink+VisuallyHidden+FocusRing+useReducedMotion
 *   npx shadcn add @interlace/layout-starter   # Container+Section+Stack+Grid+Box+Typography
 *   npx shadcn add @interlace/mdx-starter      # mdx-components.tsx defaults
 *
 * Run with `--check` to validate without writing (used by CI drift check).
 */

import { readFile, readdir, mkdir, stat } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

import { AUTHOR, HOMEPAGE, itemRef } from '../registry.config.mjs';
import { collectThemeClaims, collisionMarkdown } from '../token-namespace.mjs';
import { describeFrom } from '../blurb.mjs';
import { writeGenerated } from './lib/write-generated.mjs';

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
 * shape (consumer gets `components/ui/effects/<name>.tsx` etc.) so the
 * tiers stay distinguishable in the consumer's tree.
 *
 * Why these are ours, not external: we own the source under
 * `packages/ui/src/{effects,patterns}/`. The `components.json`
 * registries map used to include upstream registry aliases pointing
 * at upstream registries — but every component we use was already vendored
 * into our package. Pointing the registry map at our own surface promotes
 * @interlace as the single canonical install surface (per the user's
 * "promote usage + reusability of our components" directive).
 */
const DECORATIVE_DIRS = [
  // Interlace's own decorative motion and backdrops (Starfield, GradientMesh, …).
  // `strand-field` is skipped: it is a showcase built on the charts' private
  // `scale` core, which is a companion file, not an installable item.
  {
    name: 'effects',
    dir: path.join(REPO_ROOT, 'packages/ui/src/effects'),
    skip: new Set(['strand-field.tsx']),
  },
  { name: 'patterns', dir: path.join(REPO_ROOT, 'packages/ui/src/patterns') },
  // Charts — the visualisation layer. Only the `.tsx` components become items;
  // their pure cores (`scale.ts`, `graph.ts`) ride along as COMPANIONS via
  // `splitRelativeImports`, exactly like the `*-variants.ts` cva files. That is
  // deliberate: `@interlace/scale` and `@interlace/graph` would be absurdly
  // generic names to occupy in a shared registry namespace, and neither file
  // renders anything a consumer would install on its own.
  { name: 'charts', dir: path.join(REPO_ROOT, 'packages/ui/src/charts') },
  // Games — the engine of a daily game: streaks, the daily puzzle shell,
  // guess games, share cards and leaderboards. Same shape as charts: the
  // `.tsx` components are items and their pure cores (`daily.ts`,
  // `streak-model.ts`, …) ride along as companions.
  { name: 'games', dir: path.join(REPO_ROOT, 'packages/ui/src/games') },
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
 * Index just past the FIRST import statement, or -1 when the file has none.
 *
 * Deliberately textual rather than AST-based: this runs over the same source
 * the CLI will parse, and all it needs is "where does statement two begin".
 * Matches a top-of-file `import …` (single- or multi-line) up to its
 * terminating newline.
 */
const afterFirstImport = (source) => {
  const m = /^import\s[\s\S]*?(?:;|['"]\s*)\n/m.exec(source);
  return m ? m.index + m[0].length : -1;
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
 * ─── Why it goes after the first IMPORT ───────────────────────────────────
 *
 * It used to go straight after `'use client'`, and it did not survive the
 * install. `data-state.tsx` arrived in a consumer tree at 2,712 bytes from a
 * 14,314-byte item — banner gone, and with it the only mechanism the DS has
 * for telling a consumer which copy they hold.
 *
 * The cause is in the CLI, not in us, and it is two mechanisms stacked:
 *
 *   1. `shadcn` (v4.16.2) runs each file through ts-morph and returns
 *      `sourceFile.getText()`. That is `getFullText().substring(getStart(), …)`
 *      and `getStart()` skips leading trivia — so EVERY comment before the
 *      first token of the file is discarded, transform or no transform.
 *   2. Its `transformRsc` step removes the `'use client'` statement whenever
 *      `components.json` has `rsc: false` (the default). Removing that
 *      statement promotes whatever followed it to file-leading trivia, where
 *      step 1 then eats it.
 *
 * Measured across both `rsc` settings: a banner at the top of the file is
 * always lost; a banner after `'use client'` is lost when `rsc: false`; a
 * banner after the first import survives in every configuration, because it is
 * attached to a statement that is not the first token and so falls inside the
 * preserved range.
 *
 * The fallback for a file with no import at all is the end of the file —
 * unattractive, but it is inside the preserved range, and a banner the
 * consumer has to scroll for beats one that does not arrive.
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
  const cut = afterFirstImport(content);
  if (cut === -1) {
    const tail = content.endsWith('\n') ? '' : '\n';
    return `${content}${tail}\n${banner}`;
  }
  const rest = content.slice(cut);
  // A blank line on each side so the banner reads as its own block rather
  // than as a comment on the import above it or the statement below it.
  const gap = rest.startsWith('\n') ? '' : '\n';
  return content.slice(0, cut) + '\n' + banner + gap + rest;
};

/**
 * Move the file's own leading comments below the first import, in the emitted
 * copy.
 *
 * Same CLI mechanism as the banner above, so the same fix. Measured on
 * `data-state`: the item ships 14,887 bytes of `content` and the installed
 * `components/ui/data-state.tsx` was 9,741. The 5,146-byte difference was
 * exactly the leading trivia — in that file, the whole explanation of what the
 * nine states mean and why `not-counted` is not `empty`.
 *
 * Every component item lost its header the same way, and for most of them the
 * loss is more than prose: 76 sources carry a `## Anatomy` section and 90 carry
 * the R1–R26 compliance table, which is also what `src/lib/component-metadata.ts`
 * renders on the component pages.
 *
 * ─── Why the emitted copy and not `packages/ui/src` ───────────────────────
 *
 * Relocating in the sources would fix it too, but a header below the imports is
 * worse to read in ~130 files that do not have the CLI's problem. So the source
 * keeps its header at the top and only the copy is rearranged. Nothing
 * downstream cares about the position: `src/lib/component-metadata.ts` parses
 * this same emitted content (`loadItem(name).files[].content`) with
 * position-independent regexes, so the component pages see identical bytes in a
 * different order, and `describeFrom`/`metaFor`/`collectDependencies` all read
 * the untouched `source`.
 */
export const relocateDocHeader = (content) => {
  // The CLI drops exactly one range — everything before the file's first token
  // — so that range, and not "the JSDoc block", is the unit that has to move.
  // Four primitives (avatar, scroll-area, sheet, typography) and the
  // `*-variants.ts` companions lead with `//` blocks rather than JSDoc, and a
  // JSDoc-only rule would have left those to be dropped exactly as before.
  //
  // `firstStatementIndex` rather than a regex over the comment prefix: that
  // shape nests quantifiers and backtracks exponentially on `*//*` (CodeQL
  // js/redos), which is why the scan exists in the first place.
  let i = firstStatementIndex(content);
  if (i === -1 || i >= content.length) return content;
  const comments = [content.slice(0, i)];
  // A leading `'use client'` must stay the first statement, but the comments
  // UNDER it are at the same risk as the ones above: `transformRsc` deletes
  // the directive when `rsc: false`, promoting them into the dropped range.
  // The semicolon is optional: a file may open with a bare `"use client"`,
  // and requiring `;` once left such headers above the first import to be
  // dropped.
  const directive = /^['"]use \w+['"];?[ \t]*\r?\n/.exec(content.slice(i));
  const keep = directive ? directive[0] : '';
  if (directive) {
    i += keep.length;
    const j = firstStatementIndex(content.slice(i));
    if (j === -1) return content;
    comments.push(content.slice(i, i + j));
    i += j;
  }
  const header = comments.join('').trim();
  if (!header) return content;
  const body = keep ? `${keep}\n${content.slice(i)}` : content.slice(i);
  const cut = afterFirstImport(body);
  // Same fallback as the banner, for the same reason: the end of the file is
  // inside the preserved range, and a header the consumer scrolls to beats one
  // that never arrives. Only `lib/theme-tokens.ts` has no import to sit under.
  if (cut === -1) {
    const tail = body.endsWith('\n') ? '' : '\n';
    return `${body}${tail}\n${header}\n`;
  }
  const rest = body.slice(cut);
  const gap = rest.startsWith('\n') ? '' : '\n';
  return `${body.slice(0, cut)}\n${header}\n${gap}${rest}`;
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
    // Only true for items that actually declare `interlace-base` as a dependency —
    // the lib utilities don't, so telling their installer otherwise is a lie
    // printed straight into their terminal.
    ...(requiresTheme
      ? [
          '',
          'Requires the `@interlace/interlace-base` CSS baseline (installed automatically as a registry dependency). For the Interlace look, also add `@interlace/theme`.',
        ]
      : []),
  ].join('\n');

// The CSS contract ships as three items, split by what installing them does
// to the HOST app. Before Interlace 2.0 it was one `theme` item that every
// component depended on, so adding a button also swapped the app's typeface,
// set `img { display: block }` and drew a focus outline on every element.
//
//   interlace-base        every component depends on it. Additive only:
//                         new theme keys, layered colour tokens, scoped
//                         classes. `host-style-safety.test.ts` holds it there.
//   theme                 opt-in. shadcn `cssVars` that point the app's own
//                         `--primary` etc. at Interlace's brand tokens: the
//                         Interlace look, applied the way shadcn themes are.
//   interlace-foundation  opt-in. Typefaces on font-sans/font-mono, the page
//                         preflight, the fumadocs bridge, and `index.css`
//                         (the full contract, as Interlace's own apps use it).
const BASE_ITEM = 'interlace-base';
const THEME_ITEM = 'theme';
const FOUNDATION_ITEM = 'interlace-foundation';

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
 * The stylesheet items. Each ships a barrel plus leaves; files land in
 * `styles/interlace/` side by side, so a barrel's `./x.css` specifiers
 * resolve as authored, including `index.css` importing base's `base.css`.
 *
 * Order inside a barrel is load-bearing (see `packages/ui/styles/index.css`):
 * `brand/harbor.css` must follow `brand/interlace.css` or a Harbor dark page
 * resolves against Interlace's dark block. `assertStyleBarrel` turns "the
 * barrel imports exactly what the item ships" into a build-time check, so a
 * retargeted leaf fails the build instead of shipping a dangling `@import`
 * that CSS resolves to nothing, silently, at paint time.
 */
const STYLE_ITEMS = [
  {
    name: BASE_ITEM,
    title: 'Interlace Base',
    barrel: 'base.css',
    // In dependency order: brand → semantics → structure. See base.css.
    leaves: [
      'brand/interlace.css',
      // Alternate brand themes ship with the base: a theme file only
      // overrides `--interlace-*` inside `@layer interlace.brand`, which is
      // inert until something reads it, so it changes nothing in the host.
      'brand/harbor.css',
      'semantics.css',
      'structure/type.css',
      'structure/layout.css',
      'structure/radius.css',
      'structure/motion.css',
      'structure/scheme.css',
      'structure/focus.css',
      'structure/reading.css',
    ],
    requires: [],
    description:
      '@interlace/ui — the additive CSS baseline every component needs: motion tokens, type scale, container widths, the xs breakpoint, radius derived from --radius, layered brand + semantic colour tokens in OKLCH, and a color-scheme that follows the dark class so native controls match. Changes nothing the host app already styles.',
  },
  {
    name: FOUNDATION_ITEM,
    title: 'Interlace Foundation',
    barrel: 'index.css',
    leaves: ['page/fonts.css', 'page/preflight.css', 'page/fumadocs.css', 'page/shiki.css'],
    requires: [BASE_ITEM],
    description:
      '@interlace/ui — opt-in page-level styling: Inter and JetBrains Mono on font-sans / font-mono, the preflight (body colours, WCAG 2.2 focus ring, media reset, scrollbars), and the fumadocs colour bridge. Restyles the host app by design.',
  },
];

/** Every stylesheet any item ships, barrels included, in a stable order. */
const ALL_STYLE_FILES = STYLE_ITEMS.flatMap((i) => [i.barrel, ...i.leaves]);

/** The files an item can reach through its barrel: its own plus its deps'. */
const reachableFiles = (item) =>
  new Set([
    ...item.leaves,
    ...item.requires.flatMap((dep) => {
      const d = STYLE_ITEMS.find((i) => i.name === dep);
      return [d.barrel, ...d.leaves];
    }),
  ]);

/**
 * Every `@import "./x.css"` in a barrel must name a file the item (or an item
 * it requires) ships, and every leaf the item ships must be imported.
 */
const assertStyleBarrel = (item, barrelSource) => {
  const reachable = reachableFiles(item);
  const errors = [];
  for (const [, spec] of barrelSource.matchAll(
    /@import\s+["']\.\/([^"']+)["']/g,
  )) {
    if (!reachable.has(spec)) {
      errors.push(
        `${item.name}: styles/${item.barrel} imports "./${spec}", which neither it nor its dependencies ship`,
      );
    }
  }
  for (const leaf of item.leaves) {
    if (!barrelSource.includes(`"./${leaf}"`)) {
      errors.push(
        `${item.name}: styles/${leaf} is shipped but styles/${item.barrel} never imports it — a consumer using the barrel would not get it`,
      );
    }
  }
  return errors;
};

const assertStyleBarrels = async () =>
  (
    await Promise.all(
      STYLE_ITEMS.map(async (item) =>
        assertStyleBarrel(
          item,
          await readFile(path.join(STYLES_DIR, item.barrel), 'utf8'),
        ),
      ),
    )
  ).flat();

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
    name: 'use-reading-prefs',
    sourceFile: 'use-reading-prefs.ts',
    target: 'hooks/use-reading-prefs.ts',
    title: 'useReadingPrefs hook',
    description:
      '@interlace/ui — reads and writes the reader\'s text size (`data-text-size`) and contrast (`data-contrast`) on <html>, persists both, and follows `prefers-contrast` when no choice is stored.',
  },
  {
    name: 'intent',
    sourceFile: 'intent.ts',
    target: 'hooks/use-intent.ts',
    title: 'User intent hooks and provider',
    description:
      '@interlace/ui — typed, vendor-neutral user intent: activate, view, dwell, commit, disclosure and form hooks, `data-intent` for server components, rage clicks and page view/leave, all reported through one `IntentProvider` adapter. Sends nothing that identifies a person.',
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
    body: `# @interlace/a11y-starter\n\nInstalled:\n\n- \`SkipLink\` — focus-visible skip-to-main link.\n- \`VisuallyHidden\` — screen-reader-only span (component variant).\n- \`FocusRing\` — composable WCAG 2.2 SC 2.4.13 focus contract.\n- \`useReducedMotion\` — gates every animation in the DS.\n- \`interlace-base\` — the additive CSS baseline.\n\nDocs: https://ds.interlace.tools/getting-started\n`,
    registryDependencies: [
      'skip-link',
      'visually-hidden',
      'focus-ring',
      'use-reduced-motion',
      BASE_ITEM,
    ],
  },
  {
    name: 'layout-starter',
    title: 'Layout Starter',
    description:
      '@interlace/ui — the six layout primitives that compose every page. One install, the LAYOUT_PHILOSOPHY contract is satisfied.',
    target: 'components/ui/INTERLACE-LAYOUT-STARTER.md',
    body: `# @interlace/layout-starter\n\nInstalled:\n\n- \`Container\` — 4 width tiers (prose / content / wide / full).\n- \`Section\` — vertical-rhythm slabs.\n- \`Stack\` + \`Cluster\` — six-step gap scale.\n- \`Grid\` — responsive grid primitive.\n- \`Box\` — token-aware surface (background + padding + radius + border).\n- \`Typography\` — h1..h6, body, long, ui, ui-sm, caption, code variants.\n- \`interlace-base\` — the additive CSS baseline.\n\nDocs: https://ds.interlace.tools/getting-started\n`,
    registryDependencies: [
      'container',
      'section',
      'stack',
      'grid',
      'box',
      'typography',
      BASE_ITEM,
    ],
  },
  {
    name: 'mdx-starter',
    title: 'MDX Starter',
    description:
      '@interlace/ui — the components most MDX pipelines need (Callout, Prose, CodeBlock, Tag), wired through a default mdx-components.tsx.',
    target: 'components/ui/INTERLACE-MDX-STARTER.md',
    body: `# @interlace/mdx-starter\n\nInstalled:\n\n- \`Callout\` — info / warn / danger / success / note prose annotations.\n- \`Prose\` — typographic article-body wrapper.\n- \`CodeBlock\` — Shiki-rendered fenced code with copy button.\n- \`Tag\` + \`TagList\` — article tag badges.\n- \`Figure\` — image + caption + alt + AspectRatio.\n- \`interlace-base\` — the additive CSS baseline.\n\nWire into your MDX pipeline by spreading the DS defaults into your\nmdx-components.tsx. See https://ds.interlace.tools/getting-started\n`,
    registryDependencies: [
      'callout',
      'prose',
      'code-block',
      'tag',
      'figure',
      BASE_ITEM,
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
  games: 'games/',
  templates: 'templates/',
  effects: 'effects/',
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
  // A companion can lean on another companion (`order-model.ts` deals with
  // `daily.ts`'s seeded shuffle). Follow those too, or the second one is
  // missing from the item and its import dangles in the consumer's tree.
  const queue = [...companions];
  while (queue.length > 0) {
    const companion = queue.shift();
    const text = await readFile(path.join(sourceDir, `${companion}.ts`), 'utf8');
    for (const m of text.matchAll(RELATIVE_IMPORT_RE)) {
      const rel = m[1].replace(/^\.\//, '').replace(/\.js$|\.tsx?$/, '');
      if (rel.includes('/') || companions.has(rel)) continue;
      if (await exists(path.join(sourceDir, `${rel}.ts`))) {
        companions.add(rel);
        queue.push(rel);
      }
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

/**
 * Consumer-facing alias → the `registry:lib` item that ships it.
 *
 *   `@/lib/utils`               → `cn`
 *   `@/hooks/use-reduced-motion`→ `use-reduced-motion`
 *   `@/lib/theme-tokens`        → `theme-tokens`
 *   …
 *
 * Derived from LIB_FILES so it can never disagree with `rewriteImportsForConsumer`,
 * which produces exactly these specifiers.
 */
const LIB_ITEM_BY_ALIAS = new Map(
  LIB_FILES.map((e) => [`@/${e.target.replace(/\.tsx?$/, '')}`, e.name]),
);

/**
 * The `registry:lib` items an item's EMITTED content actually imports.
 *
 * This is read off the rewritten content rather than off the source, because
 * the content is what the consumer ends up with — the two can only agree if
 * one is derived from the other.
 *
 * Why this function exists at all: 102 items imported `@/lib/utils` and not
 * one declared `cn`. `cn.json` shipped `lib/utils.ts` perfectly well; nothing
 * referenced it. The install therefore succeeded and the first import in every
 * installed file failed — but only for a consumer who already had a
 * `components.json`, i.e. every real app. Anyone who reached the registry via
 * `shadcn init` got `lib/utils.ts` written by the CLI's own scaffold and never
 * saw it, and so did the E2E harness, which ran `shadcn init -d` before adding
 * anything. `assertRegistryContract` now fails the build on an undeclared lib
 * alias, and `e2e-install.mjs` installs into a pre-existing `components.json`
 * app, so neither half of that blind spot survives.
 */
const libDepsOf = (files) => {
  const found = new Set();
  for (const file of files) {
    for (const [, spec] of (file.content ?? '').matchAll(
      /from\s+['"]([^'"]+)['"]/g,
    )) {
      const item = LIB_ITEM_BY_ALIAS.get(spec);
      if (item) found.add(item);
    }
  }
  return [...found];
};

const companionContent = (content, companion, sourceDir) =>
  sourceDir === PRIMITIVES_DIR
    ? stampVersionBanner(content, companion, versionInfoFor(companion).version)
    : content;

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
  // Decorative tiers (effects / patterns) nest under their
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
  const files = [
    {
      path: `registry/interlace-ui/${subdir}${name}${ext}`,
      target,
      type: itemType,
      // Banner on the item's own file only — a companion is an
      // implementation detail of this item, and four banners in one install
      // is noise the consumer has to read past every time they open it.
      // Banner outermost, so the four short lines land between the import and
      // the component's own header rather than after several hundred of them.
      content: stampVersionBanner(
        relocateDocHeader(rewriteImportsForConsumer(source, subdir)),
        name,
        version,
      ),
    },
    ...(await Promise.all(
      companions.map(async (companion) => ({
        path: `registry/interlace-ui/${subdir}${companion}.ts`,
        target: `components/ui/${subdir}${companion}.ts`,
        type: itemType,
        // No banner of THIS item on a companion (see above), but it keeps its
        // own header — that is the file's documentation, not a repeated stamp.
        // A companion that is also published as an item of its own (every
        // `.ts` in primitives/, see buildAll) carries that item's banner, so
        // both items write the same bytes to the same target. Without it,
        // `button` shipped `button-variants.ts` unbannered while
        // `button-variants` shipped it bannered, and the consumer's copy
        // depended on which one installed last.
        content: companionContent(
          relocateDocHeader(
            rewriteImportsForConsumer(
              await readFile(path.join(sourceDir, `${companion}.ts`), 'utf8'),
              subdir,
            ),
          ),
          companion,
          sourceDir,
        ),
      })),
    )),
  ];
  // Every primitive depends on the additive base item so consumers get the
  // brand tokens + animation keyframes installed alongside the .tsx — plus
  // every `registry:lib` item the EMITTED files import (`@/lib/utils` → `cn`
  // and friends). Derived from `files`, so an item can never ship an import
  // it did not ask the CLI to install.
  const registryDependencies = [
    BASE_ITEM,
    ...[...new Set([...deps, ...libDepsOf(files)])].sort(),
  ].map(itemRef);
  const item = {
    $schema: 'https://ui.shadcn.com/schema/registry-item.json',
    name,
    type: itemType,
    title: name.replace(/(^|-)([a-z])/g, (_, dash, c) =>
      dash ? ' ' + c.toUpperCase() : c.toUpperCase(),
    ),
    // The component's own header sentence, not a restatement of its name.
    // `shadcn add` prints this, the shadcn directory lists us under it, the
    // storefront card shows it and an agent chooses on it — see blurb.mjs.
    description: describeFrom(
      source,
      name,
      `@interlace/ui — ${name}${tierLabel} (shadcn-compatible).`,
    ),
    author: AUTHOR,
    categories: categoriesFor(name, tier ?? 'primitives'),
    dependencies: collectDependencies(source),
    registryDependencies,
    files,
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
  const files = [
    {
      path: `registry/interlace-ui/lib/${entry.sourceFile}`,
      target: entry.target,
      type: 'registry:lib',
      content: stampVersionBanner(
        relocateDocHeader(source),
        entry.name,
        versionInfoFor(entry.name).version,
      ),
    },
  ];
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
    // Read off the emitted content (same rule as every other item), minus
    // itself: `LIB_ITEM_BY_ALIAS` maps this file's own target too.
    registryDependencies: libDepsOf(files)
      .filter((dep) => dep !== entry.name)
      .sort()
      .map(itemRef),
    files,
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

// ─── Stylesheet registry items ───────────────────────────────────────────────
//
// Publishes the @interlace/ui CSS contract as two `registry:style` items
// (`interlace-base`, `interlace-foundation`, see STYLE_ITEMS) and one
// `registry:theme` item (`theme`). Files land in `styles/interlace/`.
//
// The raw .css files are also copied to `public/r/styles/*.css` so
// consumers can pull them directly without the shadcn CLI (e.g. as plain
// `@import "https://ds.interlace.tools/r/styles/base.css"` URLs from
// their global stylesheet).

const STYLE_INSTALL_DOCS = {
  [BASE_ITEM]: (item) => [
    'Add ONE line to your global stylesheet, after Tailwind:',
    '',
    '```css',
    '@import "tailwindcss";',
    `@import "./styles/interlace/${item.barrel}";`,
    '```',
    '',
    'This adds tokens and never replaces your own: your `font-sans`, `rounded-*`, breakpoints, spacing and `:root` colours compile exactly as before. Components use your shadcn colours until you add `@interlace/theme`.',
  ],
  [FOUNDATION_ITEM]: (item) => [
    'Replace the `base.css` import with the full contract:',
    '',
    '```css',
    '@import "tailwindcss";',
    `@import "./styles/interlace/${item.barrel}";`,
    '```',
    '',
    'This restyles your page on purpose: Inter and JetBrains Mono on `font-sans` / `font-mono`, body colours, a focus ring on every focusable element, `img { display: block }`, thin scrollbars, and smooth scrolling. Load the fonts yourself (next/font or @font-face).',
  ],
};

const buildStyleFilesItem = async (item) => {
  const shipped = [item.barrel, ...item.leaves];
  SOURCE_PATHS.set(
    item.name,
    shipped.map((f) => `packages/ui/styles/${f}`),
  );
  const files = await Promise.all(
    shipped.map(async (name) => {
      const content = await readFile(path.join(STYLES_DIR, name), 'utf8');
      return {
        path: `registry/interlace-ui/styles/${name}`,
        target: `styles/interlace/${name}`,
        type: 'registry:style',
        content,
      };
    }),
  );
  const claims = await collectThemeClaims(item.leaves);
  return {
    $schema: 'https://ui.shadcn.com/schema/registry-item.json',
    name: item.name,
    type: 'registry:style',
    title: item.title,
    description: item.description,
    author: AUTHOR,
    categories: categoriesFor(item.name, 'theme'),
    dependencies: item.name === BASE_ITEM ? ['tw-animate-css'] : [],
    registryDependencies: item.requires.map(itemRef),
    files,
    meta: {
      tier: 'theme',
      client: false,
      minViewport: null,
      loading: false,
      ...versionMetaFor(item.name),
    },
    docs: [
      `## @interlace/${item.name}`,
      '',
      // The count comes from the array, so it cannot drift from what ships.
      `${shipped.length} stylesheets landed in \`styles/interlace/\`: the \`${item.barrel}\` barrel plus ${item.leaves.length} leaves.`,
      '',
      ...STYLE_INSTALL_DOCS[item.name](item),
      '',
      // The barrel is the point: it declares the cascade layers and imports
      // the leaves in the one order that works.
      `The barrel declares the cascade layers and imports the leaves in the one order that works (${item.leaves.join(' → ')}). Importing the leaves yourself means reproducing that order exactly.`,
      '',
      ...(claims.length ? [collisionMarkdown(claims, HOMEPAGE), ''] : []),
      `Full contract: ${HOMEPAGE}/css-contract`,
    ].join('\n'),
  };
};

/**
 * The shadcn names `theme` points at Interlace's brand tokens.
 *
 * Derived, not authored: every `--x: var(--interlace-y)` binding in
 * semantics.css whose `--x` is a variable shadcn
 * itself writes into `:root`. Interlace-only semantics (success, scrim, viz…)
 * are not here: base defines those and no host has them to replace.
 */
const SHADCN_CSS_VARS = new Set([
  'background', 'foreground', 'card', 'card-foreground', 'popover',
  'popover-foreground', 'primary', 'primary-foreground', 'secondary',
  'secondary-foreground', 'muted', 'muted-foreground', 'accent',
  'accent-foreground', 'destructive', 'destructive-foreground', 'border',
  'input', 'ring', 'chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5',
  'radius',
]);

const themeCssVars = async () => {
  const semantics = await readFile(path.join(STYLES_DIR, 'semantics.css'), 'utf8');
  const vars = {};
  for (const [, name, brand] of semantics.matchAll(
    /^\s*--([\w-]+):\s*var\(--(interlace-[\w-]+)\);/gm,
  )) {
    if (SHADCN_CSS_VARS.has(name) && !(name in vars)) vars[name] = `var(--${brand})`;
  }
  const missing = [...SHADCN_CSS_VARS].filter((n) => !(n in vars));
  if (missing.length) {
    throw new Error(
      `theme: semantics.css binds no --interlace-* token for ${missing.map((n) => `--${n}`).join(', ')}`,
    );
  }
  return vars;
};

/**
 * `theme` — the Interlace look, installed the way every shadcn theme is.
 *
 * The CLI writes these into the app's own `:root` and `.dark`. Each value is a
 * `var(--interlace-*)` rather than a colour literal, so the brand tokens base
 * ships stay the single source, and `[data-theme]` switching (Harbor) keeps
 * working: the brand layer changes `--interlace-primary`, the app's
 * `--primary` follows.
 */
const buildThemeItem = async () => {
  SOURCE_PATHS.set(THEME_ITEM, ['packages/ui/styles/semantics.css']);
  const vars = await themeCssVars();
  return {
    $schema: 'https://ui.shadcn.com/schema/registry-item.json',
    name: THEME_ITEM,
    type: 'registry:theme',
    title: 'Interlace Theme',
    description:
      '@interlace/ui — the Interlace look as shadcn cssVars: points your --primary, --background, --radius and the rest at Interlace\'s burnt-orange brand tokens (light + dark, AAA). Opt-in; components work without it.',
    author: AUTHOR,
    categories: categoriesFor(THEME_ITEM, 'theme'),
    registryDependencies: [itemRef(BASE_ITEM)],
    // A theme writes variables, not files. Empty rather than absent so every
    // tool that walks `files` (agent index, search) treats it like any item.
    files: [],
    cssVars: { light: vars, dark: vars },
    meta: {
      tier: 'theme',
      client: false,
      minViewport: null,
      loading: false,
      ...versionMetaFor(THEME_ITEM),
    },
    docs: [
      `## @interlace/${THEME_ITEM}`,
      '',
      `Updated ${Object.keys(vars).length} variables in your global stylesheet's \`:root\` and \`.dark\` to point at Interlace's brand tokens (from \`@interlace/interlace-base\`).`,
      '',
      'To re-brand, override the `--interlace-*` tokens in `@layer interlace.brand`, or set `--primary` and friends back to your own values.',
      '',
      `Themes and the full token list: ${HOMEPAGE}/theme-authoring`,
    ].join('\n'),
  };
};

const buildStyleItems = async () => [
  await buildStyleFilesItem(STYLE_ITEMS[0]),
  await buildThemeItem(),
  ...(await Promise.all(STYLE_ITEMS.slice(1).map(buildStyleFilesItem))),
];

const writeRawStyleFiles = async () => {
  for (const name of ALL_STYLE_FILES) {
    const outPath = path.join(STYLES_OUT_DIR, name);
    // `brand/harbor.css` nests; writeGenerated makes each file's directory.
    const content = await readFile(path.join(STYLES_DIR, name), 'utf8');
    await writeGenerated(outPath, content);
  }
};

const checkRawStyleFiles = async () => {
  const errors = [];
  errors.push(...(await assertStyleBarrels()));
  for (const name of ALL_STYLE_FILES) {
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
  // Stylesheet items first so they appear at the top of `index.json`.
  items.push(...(await buildStyleItems()));
  // Starter bundles next — most-prominent install surface for new consumers.
  for (const entry of STARTER_BUNDLES) items.push(buildStarterItem(entry));
  // Lib utilities — needed for components to compile in the consumer tree.
  for (const entry of LIB_FILES) items.push(await buildLibItem(entry));
  // Per-primitive items (largest cohort, alphabetical).
  for (const file of primitiveFiles) {
    items.push(await buildItem(path.join(PRIMITIVES_DIR, file), file));
  }

  // Decorative tiers (effects / patterns / templates) — our own
  // surface, promoted under the @interlace namespace.
  let decorativeCount = 0;
  for (const { name: tier, dir, skip } of DECORATIVE_DIRS) {
    let dirFiles = [];
    try {
      dirFiles = (await readdir(dir))
        .filter((f) => f.endsWith('.tsx') && !skip?.has(f))
        .sort();
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
 *   3. a dependency or `@/components/ui/*` import names an item we never ship;
 *   4. an emitted file imports a `registry:lib` alias (`@/lib/utils`,
 *      `@/hooks/use-reduced-motion`, …) that the item does not DECLARE as a
 *      registry dependency. The CLI writes only what it is told to write, so
 *      an undeclared alias is a file that will not resolve — and it is
 *      invisible to anyone who ran `shadcn init` first, because the CLI's own
 *      scaffold happens to create `lib/utils.ts`. 102 items were in this state.
 *
 * Runs on every build and in `--check` (CI), so none of the four can regress.
 */
const assertRegistryContract = (items) => {
  const names = new Set(items.map((i) => i.name));
  const errors = [];
  for (const item of items) {
    const declared = new Set(
      (item.registryDependencies ?? []).map((d) =>
        d.split('/').pop().replace(/\.json$/, ''),
      ),
    );
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
        } else if (LIB_ITEM_BY_ALIAS.has(spec)) {
          const libItem = LIB_ITEM_BY_ALIAS.get(spec);
          // An item that SHIPS the aliased file (the lib item itself) needs no
          // dependency on itself.
          const shipsItself = (item.files ?? []).some(
            (f) => `@/${f.target.replace(/\.tsx?$/, '')}` === spec,
          );
          if (!shipsItself && !declared.has(libItem)) {
            errors.push(
              `${item.name}: imports "${spec}" in ${file.target} but does not declare registry dependency "${libItem}" — the file will not exist in a consumer tree that already has components.json`,
            );
          }
        } else if (spec.startsWith('@/components/ui/')) {
          const bare = spec.replace(/^@\//, '');
          const shipsItself =
            ownTargets.has(`${bare}.ts`) || ownTargets.has(`${bare}.tsx`);
          const dep = spec.split('/').pop();
          if (!shipsItself && !names.has(dep)) {
            errors.push(`${item.name}: import "${spec}" names no item`);
          } else if (!shipsItself && !declared.has(dep)) {
            errors.push(
              `${item.name}: imports "${spec}" in ${file.target} but does not declare registry dependency "${dep}"`,
            );
          }
        }
      }
    }
  }
  // One target, one content. `shadcn add` writes each file to its `target`; two
  // items that write the same target with different bytes make the consumer's
  // copy depend on install order, and the upgrade diff then reads whichever
  // banner (or none) happened to land last.
  const byTarget = new Map();
  for (const item of items) {
    for (const file of item.files ?? []) {
      if (!file.target) continue;
      const seen = byTarget.get(file.target);
      if (!seen) byTarget.set(file.target, { item: item.name, content: file.content });
      else if (seen.content !== file.content) {
        errors.push(
          `${item.name}: writes ${file.target} with different content than ${seen.item} — a shared file must ship the same bytes from every item`,
        );
      }
    }
  }
  return errors;
};

const summary = (built) =>
  `${built.primitiveCount} primitive(s) + ${built.decorativeCount} decorative + ${STYLE_ITEMS.length + 1} style + ${ALL_STYLE_FILES.length} raw stylesheet(s) + ${LIB_FILES.length} lib + ${STARTER_BUNDLES.length} starter(s)`;

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

  const contractErrors = [
    ...assertRegistryContract(built.items),
    ...(await assertStyleBarrels()),
  ];
  if (contractErrors.length) {
    console.error(
      'Registry contract violated — these items are not installable:\n  ' +
        contractErrors.join('\n  '),
    );
    process.exit(1);
  }

  await mkdir(OUT_DIR, { recursive: true });
  for (const item of built.items) {
    await writeGenerated(
      path.join(OUT_DIR, `${item.name}.json`),
      JSON.stringify(item, null, 2) + '\n',
    );
  }
  await writeRawStyleFiles();
  const indexJson = JSON.stringify(built.index, null, 2) + '\n';
  // `registry.json` is the filename the shadcn CLI resolves for `list`/`search`,
  // and the shadcn registry directory requires it at the registry root: "a flat
  // registry ... `/registry.json` and `/component-name.json` files are expected
  // to be in the root". `index.json` stays as the alias src/lib/registry.ts reads.
  await writeGenerated(path.join(OUT_DIR, 'registry.json'), indexJson);
  await writeGenerated(path.join(OUT_DIR, 'index.json'), indexJson);

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
