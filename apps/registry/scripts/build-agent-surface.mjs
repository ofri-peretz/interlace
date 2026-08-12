#!/usr/bin/env node
/**
 * Generate the machine-readable surface of this registry, plus the search index
 * the site's own search box ranks against.
 *
 * WHY this exists at all
 * ----------------------
 * Nine competing UI registries were read in 2026-08 (DESIGN-SYSTEM-PLAN.md §5.x).
 * Not one of them publishes anything an agent can consume: magicui ships an MCP
 * server, agentcn (which is not a UI registry) ships `llms.txt` +
 * `/.well-known/agent-skills/`, and the entire UI category ships nothing. An
 * agent installing a component today has to scrape HTML.
 *
 * The thing we have that none of them do is the CONTRACT: per item, the RSC
 * boundary, `MIN_VIEWPORT`, the keyboard path, the state union, the props, and
 * a real version. That is what an agent needs to CHOOSE a component, and it is
 * what every artefact below is built out of.
 *
 * WHY it is generated
 * -------------------
 * A hand-written `llms.txt` is wrong the day someone adds a component, and
 * hand-authored search keywords rot the same way. Everything here is derived
 * from `public/r/*.json` — which is itself derived from
 * `packages/ui/src/**` by `build-registry.mjs` — so the only way to change
 * these files is to change a component. `build-registry.mjs` spawns this
 * script, and `--check` fails CI on any drift.
 *
 * Outputs
 * -------
 *   public/llms.txt                                  the llms.txt convention
 *   public/.well-known/agent-skills/index.json        skill manifest
 *   public/.well-known/agent-skills/<id>/SKILL.md     one file per skill
 *   public/data/agent-index.json                      full per-item contract
 *   public/data/search-index.json                     compact ranked-search index
 *
 * DETERMINISM: no timestamps, no git, no network. `--check` diffs the bytes
 * this script would write against the bytes on disk, so it must be a pure
 * function of tracked files — the same rule `component-versions.json` follows.
 *
 * Usage: `node scripts/build-agent-surface.mjs [--check]`
 */

import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

import { HOMEPAGE } from '../registry.config.mjs';
import { docBlocks, headerFrom } from '../blurb.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REGISTRY_ROOT = path.resolve(SCRIPT_DIR, '..');
const REPO_ROOT = path.resolve(REGISTRY_ROOT, '..', '..');
const R_DIR = path.join(REGISTRY_ROOT, 'public/r');
const PUBLIC_DIR = path.join(REGISTRY_ROOT, 'public');

const CHECK_ONLY = process.argv.includes('--check');

/** Neither index payload is an item — same exclusion `src/lib/registry.ts` makes. */
const INDEX_FILES = new Set(['index.json', 'registry.json']);

const CATEGORY_DATA = JSON.parse(
  await readFile(path.join(REGISTRY_ROOT, 'registry-categories.json'), 'utf8'),
);
const CATEGORY_TITLE = new Map(
  [...CATEGORY_DATA.categories, ...(CATEGORY_DATA.tierCategories ?? [])].map(
    (c) => [c.id, c.title],
  ),
);

// ─────────────────────────────────────────────────────────────────────────────
// Source extraction — the contract facts, read off the shipped item content
//
// Every fact below is OBSERVED in the file a consumer installs. Nothing is
// asserted that the source does not show: an item with no key handler and no
// Base UI import reports `keyboard.handled: false` rather than a guess, because
// a registry that overstates its own a11y is worse than one that says nothing.
// ─────────────────────────────────────────────────────────────────────────────

// `stripJsdoc` / `docBlocks` / `headerFrom` and the whole blurb chain moved to
// `../blurb.mjs` when `build-registry.mjs` started deriving item `description`
// from the same prose. Two copies of "what is this component for" is one copy
// too many — see that file's header.

/** `## Heading` lines from the source header — the author's own topic list. */
const topicsFrom = (header) =>
  header
    ? [
        ...new Set(
          [...header.matchAll(/^#{2,3}\s+(.+)$/gm)]
            .map(([, t]) => t.trim().replace(/\s+/g, ' '))
            .filter((t) => t.length > 2 && t.length < 120),
        ),
      ]
    : [];

const BASE_UI_RE = /from\s+['"]@base-ui\/react\/([\w-]+)['"]/;
/** `case 'Escape':` / `event.key === 'ArrowDown'` — a real handled key. */
const KEY_CASE_RE = /case\s+'([A-Z][A-Za-z]+|\s)'\s*:/g;
const KEY_EQ_RE = /\.key\s*===?\s*'([A-Za-z]+|\s)'/g;

/**
 * What a keyboard user can do with this item, and the evidence for it.
 *
 * Two honest sources: a Base UI primitive (which owns focus, roving tabindex
 * and dismissal for the composite it implements), or key handling written in
 * this file. `keys` lists only literals the file actually branches on.
 */
const keyboardFrom = (src) => {
  const baseUi = src.match(BASE_UI_RE)?.[1] ?? null;
  const keys = [
    ...new Set(
      [...src.matchAll(KEY_CASE_RE), ...src.matchAll(KEY_EQ_RE)].map(([, k]) =>
        k === ' ' ? 'Space' : k,
      ),
    ),
  ]
    // `case 'Home'` in a switch over social networks is not a key. Only accept
    // names from the UI Events `key` value list we actually use.
    .filter((k) => KNOWN_KEYS.has(k))
    .sort();
  return {
    handled: Boolean(baseUi) || keys.length > 0 || /onKeyDown/.test(src),
    baseUi,
    keys,
    ownHandler: /onKeyDown/.test(src),
  };
};

const KNOWN_KEYS = new Set([
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'Backspace',
  'ContextMenu',
  'Delete',
  'End',
  'Enter',
  'Escape',
  'Home',
  'PageDown',
  'PageUp',
  'Space',
  'Tab',
]);

/**
 * The state union(s) this item models.
 *
 * Two shapes in the corpus: `export const DATA_STATES = ['a', 'b'] as const`
 * (the precedence-ordered ladder) and `type Direction = 'up' | 'down' | 'flat'`.
 * Both are the vocabulary a caller has to satisfy, so both are published.
 */
const statesFrom = (src) => {
  const unions = [];
  for (const [, name, body] of src.matchAll(
    /export\s+const\s+([A-Z][A-Z0-9_]*)\s*=\s*\[([^\]]*)\]\s*as\s+const/g,
  )) {
    const values = [...body.matchAll(/'([a-z][a-z0-9-]*)'/g)].map(([, v]) => v);
    if (values.length > 1) unions.push({ name, values });
  }
  // Grab the whole right-hand side, then validate the members by SPLITTING.
  //
  // The previous shape was
  // `/\btype\s+(\w+)\s*=\s*((?:\s*\|?\s*'…'\s*)+);/` — a group ending in
  // `\s*` repeated by `+`, with another `\s*` at its start. Two adjacent
  // optional whitespace runs inside a repeated group is the textbook
  // catastrophic-backtracking shape: on a near-miss the engine has
  // exponentially many ways to divide the same spaces between them. CodeQL
  // flagged it `js/redos` at HIGH, and it was right. The input here is our own
  // source, so it was never reachable by an attacker — but this file is a
  // build script we ship the output of, and "the input happens to be trusted"
  // is a property of today's caller, not of the regex.
  //
  // `[^;\n]*` is linear. Splitting on `|` and testing each member with an
  // anchored, quantifier-free pattern is linear. Same result, no backtracking.
  for (const [, name, body] of src.matchAll(/\btype\s+(\w+)\s*=\s*([^;\n]*);/g)) {
    const members = body.split('|').map((m) => m.trim());
    if (members.length < 2) continue;
    if (!members.every((m) => /^'[a-z][a-z0-9-]*'$/.test(m))) continue;
    unions.push({ name, values: members.map((m) => m.slice(1, -1)) });
  }
  // De-dupe on name; a re-exported alias would otherwise list twice.
  const seen = new Set();
  return unions.filter((u) => !seen.has(u.name) && seen.add(u.name));
};

const A11Y_ROLE_RE = /\brole\s*[=:]\s*['"]([\w-]+)['"]/g;
const A11Y_ARIA_RE = /\b(aria-[a-z]+)\s*[=:]/g;

/**
 * What actually moves, and whether the OS preference can stop it.
 *
 * The old field here was a single boolean, `reducedMotion`, documented as "the
 * component gates its animation on the OS setting". It was a regex for
 * `useReducedMotion|prefers-reduced-motion|motion-reduce:` — i.e. it reported
 * whether the file MENTIONS the preference, and then published that as a claim
 * that the file HONOURS it. `animated-list` mentions it (it gates auto-advance)
 * while every entry still springs in from `scale: 0` under `reduce`. So the
 * registry was overstating its own accessibility, which this script's own
 * header calls worse than saying nothing.
 *
 * The honest split is by DRIVER, because the driver decides who is responsible:
 *
 *   css — `animate-*`, a keyframe, a Tailwind transition. `preflight.css`
 *         clamps `animation-duration` and `transition-duration` to 0.01ms under
 *         `reduce`, with `!important`, for `*`. A CSS-driven component is
 *         covered whether or not it says so, PROVIDED the consumer imports that
 *         stylesheet — which the `index.css` barrel guarantees and an
 *         à-la-carte import does not.
 *   js  — `motion`/`framer-motion`, `requestAnimationFrame`, `setInterval`, a
 *         timer-driven step. NOTHING in any stylesheet reaches these. The
 *         component must gate itself or it ignores the user's preference
 *         outright (WCAG 2.3.3).
 *
 * `declaresPreference` is reported as exactly what it is — the file references
 * the preference somewhere — and NOT as "every animation in it is gated", which
 * is not decidable by reading text. The pair is still the useful signal: a
 * `js` driver with no reference at all cannot be honouring the preference, and
 * that is a fact, not an inference. `motion-driver-lock` fails the build on it.
 */
const JS_MOTION_RE =
  /from\s+['"](?:motion|framer-motion)|requestAnimationFrame|setInterval\(|animate\(/;
const CSS_MOTION_RE = /animate-[a-z]|@keyframes|transition-(?:all|colors|transform|opacity)|duration-\d/;
const PREFERENCE_RE = /useReducedMotion|prefers-reduced-motion|motion-reduce:|motion-safe:/;

export const motionFrom = (src) => {
  const js = JS_MOTION_RE.test(src);
  const css = CSS_MOTION_RE.test(src);
  return {
    driver: js && css ? 'both' : js ? 'js' : css ? 'css' : 'none',
    declaresPreference: PREFERENCE_RE.test(src),
    // The one thing a stylesheet cannot save. Not "this component is broken" —
    // "this component's motion is out of reach of every reset we ship".
    stylesheetCannotReach: js,
  };
};

const a11yFrom = (src) => ({
  roles: [...new Set([...src.matchAll(A11Y_ROLE_RE)].map(([, r]) => r))].sort(),
  aria: [...new Set([...src.matchAll(A11Y_ARIA_RE)].map(([, a]) => a))].sort(),
  motion: motionFrom(src),
  focusRing: /focus-visible:|FocusRing/.test(src),
});

const EXPORT_RE = /\bexport\s+(?:const|function|class)\s+([A-Z]\w+)/g;
const exportsFrom = (src) =>
  [...new Set([...src.matchAll(EXPORT_RE)].map(([, n]) => n))].sort();

// ─────────────────────────────────────────────────────────────────────────────
// The ranker's vocabulary
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Suffix-stripping stemmer, ~40 lines instead of a dependency.
 *
 * It exists for one job: make "measure" / "measured" / "measuring" /
 * "measurement" collide, so a visitor asking for "a metric that might not have
 * been measured" reaches the component whose header says "first-measurement".
 * The SAME function has to run on the client, so it is duplicated —
 * deliberately and with this note — in `src/components/registry-search.tsx`;
 * a shared module would have to be either a `.mjs` the bundler ships or a `.ts`
 * this Node script cannot import, and the function is 20 lines of pure string
 * work with a lock test asserting the two copies agree.
 */
export const stem = (word) => {
  let w = word.toLowerCase().replace(/[^a-z0-9]+/g, '');
  if (w.length <= 3) return w;
  if (w.endsWith('ies') && w.length > 4) w = `${w.slice(0, -3)}y`;
  else if (w.endsWith('sses')) w = w.slice(0, -2);
  else if (
    w.endsWith('s') &&
    !w.endsWith('ss') &&
    !w.endsWith('us') &&
    !w.endsWith('is')
  )
    w = w.slice(0, -1);
  if (w.endsWith('ment') && w.length > 6) w = w.slice(0, -4);
  if (w.endsWith('ing') && w.length > 5) w = w.slice(0, -3);
  else if (w.endsWith('edly') && w.length > 6) w = w.slice(0, -4);
  else if (w.endsWith('ed') && w.length > 4) w = w.slice(0, -2);
  if (w.endsWith('ly') && w.length > 4) w = w.slice(0, -2);
  if (w.endsWith('e') && w.length > 4) w = w.slice(0, -1);
  return w;
};

/**
 * Stopwords. Two groups, and the second is the interesting one: words that are
 * meaningful English but carry zero signal HERE because every item says them
 * ("component", "interlace", "props", "consumer"). TF-IDF would score them near
 * zero anyway; excluding them keeps the per-item term budget for words that
 * actually separate one component from another.
 */
const STOPWORDS = new Set(
  `a about above after again against all also am an and any are aren as at be because been before
   being below between both but by can cannot could did do does doing don down during each few for
   from further had has have having he her here hers herself him himself his how i if in into is it
   its itself just me more most my myself no nor not now of off on once only or other ought our ours
   ourselves out over own same she should so some such than that the their theirs them themselves
   then there these they this those through to too under until up very was we were what when where
   which while who whom why will with would you your yours yourself yourselves it's don't isn't
   thing things one two three way ways make makes made get gets got give gives put puts take takes
   see sees say says use used using uses via per etc eg ie
   not might must may need needs want wants something anything please maybe perhaps able
   interlace ui component components consumer consumers prop props file files import imports export
   exports react tsx typescript source code line lines class classname css div span const type types
   default defaults value values return returns function functions rule rules note notes see also
   example examples docs doc doesn wasn won isn aren couldn shouldn wouldn
   `
    .split(/\s+/)
    .filter(Boolean)
    .map(stem),
);

export const tokenize = (text) =>
  text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map(stem)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));

/** How many distinctive terms each item contributes to the search index. */
const TERM_BUDGET = 64;

// ─────────────────────────────────────────────────────────────────────────────
// Build
// ─────────────────────────────────────────────────────────────────────────────

const itemUrl = (name) => `${HOMEPAGE}/r/${name}.json`;
const docsUrl = (name) => `${HOMEPAGE}/c/${name}`;
const installCmd = (name) => `npx shadcn@latest add ${itemUrl(name)}`;

/** The one-word contract facets, used as both index terms and agent filters. */
const facetsFor = (item, keyboard, states) => {
  const f = [];
  f.push(item.meta?.client ? 'client' : 'server');
  if (!item.meta?.client) f.push('rsc', 'server-component');
  if (item.meta?.loading) f.push('loading', 'skeleton');
  if (item.meta?.minViewport) f.push('responsive', `min-viewport-${item.meta.minViewport}`);
  if (keyboard.handled) f.push('keyboard');
  if (keyboard.baseUi) f.push('base-ui', keyboard.baseUi);
  if (states.length) f.push('states', ...states.flatMap((s) => s.values));
  if (item.meta?.deprecated) f.push('deprecated');
  f.push(item.meta?.tier ?? 'other', ...(item.categories ?? []));
  return [...new Set(f)];
};

const readItems = async () => {
  const files = (await readdir(R_DIR))
    .filter((f) => f.endsWith('.json') && !INDEX_FILES.has(f))
    .sort();
  const items = [];
  for (const file of files) {
    const item = JSON.parse(await readFile(path.join(R_DIR, file), 'utf8'));
    if (!Array.isArray(item.files)) continue;
    const src = item.files.map((f) => f.content ?? '').join('\n');
    const blocks = docBlocks(src);
    const comments = blocks.map((b) => b.text);
    const header = headerFrom(blocks, src);
    const keyboard = keyboardFrom(src);
    const states = statesFrom(src);
    items.push({
      raw: item,
      src,
      comments,
      header,
      // `description` IS the blurb now — `build-registry.mjs` derives it from
      // the same prose via `blurb.mjs`. Deriving it a second time here is how
      // the two surfaces drift; reading it back is how they cannot.
      blurb: item.description,
      topics: topicsFrom(header),
      keyboard,
      states,
      a11y: a11yFrom(src),
      exports: exportsFrom(src),
      facets: facetsFor(item, keyboard, states),
    });
  }
  return items;
};

/**
 * Per-item term list, ranked by tf-idf over the corpus of source doc comments.
 *
 * The corpus is the prose the component's own author wrote — 223 KB of it
 * across 133 items — not the JSX. Class-name soup (`rounded-lg bg-card`) would
 * bury the vocabulary a visitor actually types.
 */
const buildTerms = (items) => {
  const docs = items.map((it) => {
    const text = [
      it.raw.title,
      it.raw.name.replace(/-/g, ' '),
      // The starter bundles and the `theme` style item carry no JS doc comments
      // at all — a starter ships one README, `theme` ships CSS. Their
      // hand-written `description` and their Markdown payload ARE their prose,
      // and without these two lines they were indexed on their name alone.
      it.raw.description,
      ...it.raw.files
        .filter((f) => /\.mdx?$/.test(f.target))
        .map((f) => f.content ?? ''),
      ...(it.raw.categories ?? []),
      ...it.exports,
      ...it.topics,
      ...it.comments,
      ...it.facets,
    ].join('\n');
    const tf = new Map();
    for (const t of tokenize(text)) tf.set(t, (tf.get(t) ?? 0) + 1);
    return tf;
  });

  const df = new Map();
  for (const tf of docs) for (const t of tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);

  const n = docs.length;
  const terms = docs.map((tf, i) => {
    // Identity terms always survive the budget: a query for the component's own
    // name must never lose to a term that merely scored higher.
    const forced = new Set(
      tokenize(
        [
          items[i].raw.name.replace(/-/g, ' '),
          items[i].raw.title,
          ...(items[i].raw.categories ?? []),
          ...items[i].facets,
          ...items[i].exports,
        ].join(' '),
      ),
    );
    const ranked = [...tf.entries()]
      .map(([t, freq]) => [t, freq * Math.log(1 + n / (df.get(t) ?? 1))])
      .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
      .map(([t]) => t);
    const out = [...forced];
    for (const t of ranked) {
      if (out.length >= TERM_BUDGET) break;
      if (!forced.has(t)) out.push(t);
    }
    return out;
  });

  return { terms, df, n };
};

const buildAgentIndex = (items) => ({
  $schema: 'https://ds.interlace.tools/data/agent-index.json',
  schemaVersion: 'interlace-agent-index/1',
  $comment:
    'GENERATED by apps/registry/scripts/build-agent-surface.mjs from public/r/*.json. Do not edit.',
  registry: {
    name: 'interlace-ui',
    title: 'Interlace Design System',
    homepage: HOMEPAGE,
    license: 'MIT',
    shadcnRegistry: `${HOMEPAGE}/r/registry.json`,
    itemUrlTemplate: `${HOMEPAGE}/r/{name}.json`,
    docsUrlTemplate: `${HOMEPAGE}/c/{name}`,
    installTemplate: `npx shadcn@latest add ${HOMEPAGE}/r/{name}.json`,
    aliasInstallTemplate: 'npx shadcn@latest add @interlace/{name}',
    aliasNote:
      'The @interlace/{name} form only resolves for consumers who registered the namespace in components.json; the absolute URL always works.',
    itemCount: items.length,
  },
  fieldGuide: {
    'meta.tier':
      'Which DS layer the item belongs to: theme, lib, primitive, pattern, template, effects, charts. Composition runs upward only — a primitive never imports a pattern.',
    'meta.client':
      'true when the installed file carries the "use client" directive. false means it is safe inside a React Server Component with no boundary.',
    'meta.minViewport':
      'The narrowest viewport in CSS px this component is designed to render correctly at, declared in source as `export const MIN_VIEWPORT`. null means it inherits the min-viewport of whatever it renders and introduces no floor of its own.',
    'meta.loading':
      'true when the component accepts `loading?: boolean` and renders its own skeleton — the DS-wide opt-in, so a caller never hand-rolls a placeholder.',
    'meta.version':
      "The component's own semver, derived from its git history and stamped into the banner of the file you install.",
    'meta.since': 'The @interlace/ui release the component first shipped in.',
    'meta.deprecated':
      'Present only when the item is on its way out. Carries `removedIn` (a real release, never "eventually") and `replacement`.',
    keyboard:
      'Observed evidence only. `baseUi` names the Base UI primitive that owns focus and dismissal; `keys` lists the UI Events key values this file branches on itself; `handled` is the disjunction. An item with handled:false is not asserted to be inaccessible — it is asserted to add no keyboard behaviour of its own.',
    states:
      'The string unions a caller has to satisfy, read from the source. Where a union is a precedence ladder (DATA_STATES) the array order IS the precedence, lowest index wins.',
    a11y: 'ARIA roles and attributes written literally in the shipped file, what drives its motion (a CSS driver is clamped by our preflight; a JS driver is out of reach of it), whether the file references prefers-reduced-motion at all, and whether it opts into the WCAG 2.2 SC 2.4.13 focus ring.',
  },
  facets: {
    tier: tally(items, (it) => [it.raw.meta?.tier ?? 'unknown']),
    category: tally(items, (it) => it.raw.categories ?? []),
    rendering: tally(items, (it) => [it.raw.meta?.client ? 'client' : 'server']),
    keyboard: tally(items, (it) => [it.keyboard.handled ? 'handled' : 'none']),
    loading: tally(items, (it) => [it.raw.meta?.loading ? 'built-in' : 'none']),
    minViewport: tally(items, (it) => [String(it.raw.meta?.minViewport ?? 'inherited')]),
  },
  items: items.map((it) => ({
    name: it.raw.name,
    title: it.raw.title,
    type: it.raw.type,
    summary: it.blurb,
    topics: it.topics,
    categories: it.raw.categories ?? [],
    tier: it.raw.meta?.tier ?? null,
    rendering: it.raw.meta?.client ? 'client' : 'server',
    minViewport: it.raw.meta?.minViewport ?? null,
    loadingState: Boolean(it.raw.meta?.loading),
    keyboard: it.keyboard,
    states: it.states,
    a11y: it.a11y,
    exports: it.exports,
    version: it.raw.meta?.version ?? null,
    since: it.raw.meta?.since ?? null,
    ...(it.raw.meta?.deprecated ? { deprecated: it.raw.meta.deprecated } : {}),
    npmDependencies: it.raw.dependencies ?? [],
    registryDependencies: (it.raw.registryDependencies ?? [])
      .map((d) => d.split('/').pop().replace(/\.json$/, ''))
      .sort(),
    installsTo: it.raw.files.map((f) => f.target),
    install: installCmd(it.raw.name),
    item: itemUrl(it.raw.name),
    docs: docsUrl(it.raw.name),
  })),
});

const tally = (items, pick) => {
  const counts = {};
  for (const it of items) for (const k of pick(it)) counts[k] = (counts[k] ?? 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1]));
};

const buildSearchIndex = (items, { terms, df, n }) => ({
  schemaVersion: 'interlace-search-index/1',
  $comment:
    'GENERATED by apps/registry/scripts/build-agent-surface.mjs. Consumed by src/components/registry-search.tsx. Do not edit.',
  docs: n,
  // Shipped, not duplicated in the client. The ranker has to drop exactly the
  // words the indexer dropped — a query stem the index can never contain would
  // otherwise count against every item's term coverage and flatten the ranking.
  // One list, generated once, read by both sides.
  stopwords: [...STOPWORDS].sort(),
  // Document frequency for every stem that survived some item's term budget, so
  // the client can compute idf without re-reading the corpus. This is what lets
  // a rare word ("hatch", "uncounted") outrank a common one ("card") in the same
  // query. `df` counts occurrences over the FULL corpus even though the map is
  // pruned to reachable stems — pruning the map does not distort the weights,
  // because a stem no item kept cannot be matched anyway.
  df: Object.fromEntries(
    (() => {
      const reachable = new Set(terms.flat());
      return [...df.entries()]
        .filter(([t]) => reachable.has(t))
        .sort((a, b) => (a[0] < b[0] ? -1 : 1));
    })(),
  ),
  items: items.map((it, i) => ({
    name: it.raw.name,
    title: it.raw.title,
    blurb: it.blurb,
    tier: it.raw.meta?.tier ?? null,
    categories: it.raw.categories ?? [],
    facets: it.facets,
    terms: terms[i].join(' '),
  })),
});

// ─────────────────────────────────────────────────────────────────────────────
// llms.txt
// ─────────────────────────────────────────────────────────────────────────────

const contractLine = (it) => {
  const bits = [it.raw.meta?.client ? 'client' : 'server'];
  if (it.raw.meta?.minViewport) bits.push(`min ${it.raw.meta.minViewport}px`);
  if (it.raw.meta?.loading) bits.push('loading state');
  if (it.keyboard.baseUi) bits.push(`keyboard via Base UI ${it.keyboard.baseUi}`);
  else if (it.keyboard.keys.length) bits.push(`keys ${it.keyboard.keys.join('/')}`);
  if (it.states.length) bits.push(`states ${it.states[0].values.join('|')}`);
  if (it.raw.meta?.version) bits.push(`v${it.raw.meta.version}`);
  if (it.raw.meta?.deprecated)
    bits.push(`DEPRECATED — removed in ${it.raw.meta.deprecated.removedIn}`);
  return bits.join(', ');
};

const TIER_ORDER = ['theme', 'lib', 'primitive', 'pattern', 'template', 'charts', 'effects'];

const buildLlmsTxt = (items, agentIndex) => {
  const byTier = new Map();
  for (const it of items) {
    const tier = it.raw.meta?.tier ?? 'other';
    if (!byTier.has(tier)) byTier.set(tier, []);
    byTier.get(tier).push(it);
  }
  const tiers = [...byTier.keys()].sort(
    (a, b) =>
      (TIER_ORDER.indexOf(a) + 1 || 99) - (TIER_ORDER.indexOf(b) + 1 || 99) ||
      (a < b ? -1 : 1),
  );

  const out = [];
  out.push('# Interlace Design System — component registry');
  out.push('');
  out.push(
    `> ${items.length} installable React components served over the shadcn registry protocol. Every item publishes its contract — the React Server Component boundary, a declared minimum viewport, the keyboard path, the state union it models, and its own semver — so a machine can choose a component on facts instead of on a screenshot.`,
  );
  out.push('');
  out.push(
    'Install copies source into the consumer tree; there is no runtime package to depend on. MIT. Built on Base UI and Tailwind CSS v4.',
  );
  out.push('');

  out.push('## Install');
  out.push('');
  out.push('```bash');
  out.push(`# any item, by absolute URL — always works`);
  out.push(`npx shadcn@latest add ${HOMEPAGE}/r/button.json`);
  out.push('');
  out.push('# the CSS baseline every component assumes (pulled automatically as a');
  out.push('# registry dependency, but install it first for a bare project)');
  out.push(`npx shadcn@latest add ${HOMEPAGE}/r/theme.json`);
  out.push('```');
  out.push('');
  out.push(
    'The `@interlace/<name>` short form also works, but only after the namespace is registered in the consumer\'s `components.json`. Prefer the absolute URL in generated instructions.',
  );
  out.push('');

  out.push('## Machine-readable index');
  out.push('');
  out.push(
    `- [${HOMEPAGE}/data/agent-index.json](${HOMEPAGE}/data/agent-index.json): every item with its full contract — tier, rendering boundary, minViewport, keyboard evidence, state unions, ARIA, exports, versions, dependency graph and install command. Start here; it is the only file that lets you FILTER.`,
  );
  out.push(
    `- [${HOMEPAGE}/r/registry.json](${HOMEPAGE}/r/registry.json): the shadcn registry index (the format the CLI reads).`,
  );
  out.push(
    `- [${HOMEPAGE}/r/{name}.json](${HOMEPAGE}/r/button.json): one shadcn registry item — full file contents, targets, dependencies.`,
  );
  out.push(
    `- [${HOMEPAGE}/.well-known/agent-skills/index.json](${HOMEPAGE}/.well-known/agent-skills/index.json): what an agent can do here, as skills.`,
  );
  out.push(
    `- [${HOMEPAGE}/data/story-map.json](${HOMEPAGE}/data/story-map.json): item → Storybook story ids, for a live render of any documented state.`,
  );
  out.push(
    `- [${HOMEPAGE}/data/changelog.json](${HOMEPAGE}/data/changelog.json): release history, per component.`,
  );
  out.push('');

  out.push('## How to choose a component');
  out.push('');
  out.push(
    'Filter `agent-index.json` on the contract, not on the name. The fields that decide whether an item can be used at all:',
  );
  out.push('');
  for (const [field, text] of Object.entries(agentIndex.fieldGuide)) {
    out.push(`- \`${field}\` — ${text}`);
  }
  out.push('');
  out.push('Current distribution across the catalogue:');
  out.push('');
  out.push(
    `- rendering: ${Object.entries(agentIndex.facets.rendering)
      .map(([k, v]) => `${v} ${k}`)
      .join(', ')}`,
  );
  out.push(
    `- keyboard: ${Object.entries(agentIndex.facets.keyboard)
      .map(([k, v]) => `${v} ${k}`)
      .join(', ')}`,
  );
  out.push(
    `- built-in loading state: ${agentIndex.facets.loading['built-in'] ?? 0} of ${items.length}`,
  );
  out.push(
    `- declared minViewport: ${Object.entries(agentIndex.facets.minViewport)
      .map(([k, v]) => `${v} at ${k}`)
      .join(', ')}`,
  );
  out.push('');

  out.push('## Taxonomy');
  out.push('');
  out.push(
    'Two axes, both on every item. **Tier** is the DS layer (composition runs upward only). **Category** is intent.',
  );
  out.push('');
  for (const [tier, count] of Object.entries(agentIndex.facets.tier)) {
    out.push(`- tier \`${tier}\` — ${count} item(s)`);
  }
  out.push('');
  for (const [cat, count] of Object.entries(agentIndex.facets.category)) {
    const title = CATEGORY_TITLE.get(cat);
    out.push(`- category \`${cat}\`${title ? ` (${title})` : ''} — ${count} item(s)`);
  }
  out.push('');

  for (const tier of tiers) {
    const list = byTier.get(tier).slice().sort((a, b) => (a.raw.name < b.raw.name ? -1 : 1));
    out.push(`## Items — tier \`${tier}\``);
    out.push('');
    for (const it of list) {
      out.push(`- [${it.raw.title}](${docsUrl(it.raw.name)}): ${it.blurb}`);
      out.push(`  - install: \`${installCmd(it.raw.name)}\``);
      out.push(`  - contract: ${contractLine(it)}`);
    }
    out.push('');
  }

  out.push('## Optional');
  out.push('');
  out.push(
    `- [${HOMEPAGE}/getting-started](${HOMEPAGE}/getting-started): human install guide.`,
  );
  out.push(
    `- [${HOMEPAGE}/css-contract](${HOMEPAGE}/css-contract): what \`theme.json\` installs, layer by layer.`,
  );
  out.push(
    `- [${HOMEPAGE}/semantics-catalog](${HOMEPAGE}/semantics-catalog): every semantic token with its light and dark value.`,
  );
  out.push(
    `- [${HOMEPAGE}/theme-authoring](${HOMEPAGE}/theme-authoring): writing an alternate brand theme.`,
  );
  out.push('');
  return `${out.join('\n')}`;
};

// ─────────────────────────────────────────────────────────────────────────────
// /.well-known/agent-skills/
//
// Three skills, because there are exactly three things an agent does with a
// component registry: find the right item, read enough of its contract to be
// sure, and install it. Each SKILL.md is generated, so the counts, the facet
// values and the worked examples are the live catalogue and cannot drift.
// ─────────────────────────────────────────────────────────────────────────────

const frontmatter = (fields) =>
  ['---', ...Object.entries(fields).map(([k, v]) => `${k}: ${v}`), '---'].join('\n');

const exampleNames = (items, predicate, limit = 4) =>
  items
    .filter(predicate)
    .slice(0, limit)
    .map((it) => it.raw.name);

const skillDiscover = (items, agentIndex) => {
  const serverLoading = exampleNames(
    items,
    (it) => !it.raw.meta?.client && it.raw.meta?.loading,
  );
  const kbd = exampleNames(items, (it) => it.keyboard.keys.length > 0);
  const stateful = items.filter((it) => it.states.length > 0);
  return `${frontmatter({
    name: 'discover-interlace-components',
    description:
      'Find a component in the Interlace design system by what it must DO — server-safe, keyboard-operable, has a loading state, models an absence — rather than by name. Use before writing any UI against this registry.',
    license: 'MIT',
  })}

# Discover Interlace components by contract

## When to use this

The visitor described a behaviour, not a component name: "something that shows a
metric that might not have been measured", "a menu that works from the keyboard",
"a card I can render on the server". Names will not get you there. The contract
will.

## The one file you need

\`GET ${HOMEPAGE}/data/agent-index.json\`

${agentIndex.items.length} items, each with \`tier\`, \`categories\`, \`summary\`, \`topics\`,
\`rendering\`, \`minViewport\`, \`loadingState\`, \`keyboard\`, \`states\`, \`a11y\`,
\`exports\`, \`version\` and \`install\`. It is a flat array — filter it directly.

## Filters that answer real questions

\`\`\`bash
# usable inside a React Server Component, with its own skeleton
jq '.items[] | select(.rendering=="server" and .loadingState) | .name' agent-index.json
# → ${serverLoading.join(', ') || '(none)'}

# owns its own key handling (not just inherited from Base UI)
jq '.items[] | select(.keyboard.keys | length > 0) | {name, keys: .keyboard.keys}' agent-index.json
# → ${kbd.join(', ') || '(none)'}

# models an explicit state union — i.e. absence is a value, not a null check
jq '.items[] | select(.states | length > 0) | {name, states: [.states[].name]}' agent-index.json
# → ${stateful.length} item(s)

# safe down to a 320px viewport
jq '.items[] | select(.minViewport == null or .minViewport <= 320) | .name' agent-index.json
\`\`\`

## The vocabulary that matters here

${Object.entries(agentIndex.fieldGuide)
  .map(([k, v]) => `- \`${k}\` — ${v}`)
  .join('\n')}

## Worked example

> "I need to show a number that might never have been measured."

1. Filter for a state union that distinguishes *no run* from *measured zero*:
   \`jq '.items[] | select(.states[]?.values[]? | test("not-counted|first-measurement"))'\`
2. That returns ${stateful
   .filter((it) =>
     it.states.some((s) =>
       s.values.some((v) => /not-counted|first-measurement/.test(v)),
     ),
   )
   .map((it) => it.raw.name)
   .join(', ') || '(no item currently declares those values)'}.
3. Read its \`summary\` and \`topics\` before installing — the header prose says
   what each state is *entitled to claim*, which the union alone does not.

## What NOT to conclude

\`keyboard.handled: false\` means the file adds no key handling of its own. It is
not a claim that the component is inaccessible — a \`<button>\` needs none. Never
report an item as failing accessibility on the strength of this field.

## Next

- To read one item in full: \`read-interlace-contract\`.
- To install: \`install-interlace-component\`.
`;
};

const skillInstall = (items, agentIndex) => {
  const withRegistryDeps = agentIndex.items.filter(
    (i) => i.registryDependencies.length > 1,
  ).length;
  return `${frontmatter({
    name: 'install-interlace-component',
    description:
      'Install a component from the Interlace registry into a project with the shadcn CLI, including the CSS baseline it assumes and the dependency graph the CLI walks. Use when a component has been chosen and needs to land in a repo.',
    license: 'MIT',
  })}

# Install an Interlace component

## The command

\`\`\`bash
npx shadcn@latest add ${HOMEPAGE}/r/<name>.json
\`\`\`

Always the absolute URL in generated instructions. A **bare name** (\`shadcn add
button\`) resolves against ui.shadcn.com and installs somebody else's component;
the \`@interlace/<name>\` short form only resolves for a project that already
registered the namespace in \`components.json\`:

\`\`\`json
{ "registries": { "@interlace": "${HOMEPAGE}/r/{name}.json" } }
\`\`\`

## Prerequisites

1. A shadcn-initialised project (\`components.json\` present, Tailwind CSS v4).
2. The CSS baseline: \`npx shadcn@latest add ${HOMEPAGE}/r/theme.json\`.
   Every component assumes its tokens, the WCAG 2.2 SC 2.4.13 focus ring, and
   the \`[data-min-viewport]\` container contract. The CLI pulls it as a registry
   dependency of any component, so a normal install gets it — install it first
   only when starting from bare.

## What actually lands

Each item's \`installsTo\` (in \`${HOMEPAGE}/data/agent-index.json\`) lists the
exact target paths. Items are **copied**, not linked: after install the files are
the consumer's. Each carries a generated banner with its version and a link to
\`${HOMEPAGE}/c/<name>#history\` — leave the banner in place, it is the only
thing an upgrade diff can read.

${withRegistryDeps} item(s) declare more than one registry dependency; the CLI
walks that graph transitively, so installing one pattern can write several files.

## Starter bundles

One install for a whole contract instead of a list of names:

${items
  .filter((it) => it.raw.name.endsWith('-starter'))
  .map(
    (it) =>
      `- \`npx shadcn@latest add ${HOMEPAGE}/r/${it.raw.name}.json\` — ${it.raw.title}: ${it.blurb}`,
  )
  .join('\n')}

## Verify

\`\`\`bash
# the item exists and is well-formed before you shell out to the CLI
curl -sfL ${HOMEPAGE}/r/<name>.json | jq '.name, .type, .meta'
\`\`\`

A 404 means the name is wrong — list the real ones from
\`${HOMEPAGE}/r/registry.json\`. Do not guess a name from a screenshot.

## Deprecations

An item may carry \`meta.deprecated\` with \`removedIn\` and \`replacement\`. Install
the replacement instead, and say why.
${
  agentIndex.items.some((i) => i.deprecated)
    ? `\nCurrently deprecated: ${agentIndex.items
        .filter((i) => i.deprecated)
        .map((i) => `\`${i.name}\` → ${i.deprecated.replacement}`)
        .join('; ')}.\n`
    : '\nNothing in the catalogue is deprecated right now.\n'
}`;
};

const skillContract = (items) => {
  const example =
    items.find((it) => it.states.length > 0 && it.keyboard.handled) ??
    items.find((it) => it.states.length > 0) ??
    items[0];
  return `${frontmatter({
    name: 'read-interlace-contract',
    description:
      'Read one Interlace component’s full contract — props, state union, keyboard path, ARIA, minimum viewport, version history — before generating code against it. Use whenever an item has been picked but its API is not yet known.',
    license: 'MIT',
  })}

# Read one component's contract

## Two fetches, in this order

\`\`\`bash
# 1. the contract summary — cheap, already parsed
curl -sfL ${HOMEPAGE}/data/agent-index.json | jq '.items[] | select(.name=="<name>")'

# 2. the item itself — the exact source that will land in the tree
curl -sfL ${HOMEPAGE}/r/<name>.json | jq '{name, dependencies, registryDependencies, files: [.files[].target]}'
\`\`\`

The item's \`files[].content\` is the shipped source. Its leading JSDoc block is
the authoritative contract: the anatomy, the rules table, the \`MIN_VIEWPORT\`
rationale, and — for anything that models absence — what each state is entitled
to claim. Read it before writing props; the props table on
\`${HOMEPAGE}/c/<name>\` is parsed from that same source.

## What to read, and what each field commits you to

- \`rendering\` — \`client\` means the file has \`"use client"\`. Importing it from a
  Server Component is fine; rendering it *as* one is not.
- \`minViewport\` — the narrowest viewport in CSS px it is designed for. \`null\`
  means it adds no floor. If your layout is narrower than the number, the
  component is not the thing that is wrong.
- \`states\` — the union a caller must satisfy. Where the union is a precedence
  ladder, **array order is the precedence, lowest index wins**. Two states can
  co-occur; a resolver that returns one name silently drops the second fact.
- \`keyboard.baseUi\` — the Base UI primitive that owns focus, roving tabindex and
  dismissal. If it is set, do not re-implement key handling on top.
- \`keyboard.keys\` — the key values this file branches on itself. This is the
  behaviour a static a11y scan cannot see, so it is the behaviour to test.
- \`a11y.motion.driver\` — \`css\` | \`js\` | \`both\` | \`none\`. This decides WHO
  honours \`prefers-reduced-motion\`. A \`css\` driver is clamped to 0.01ms by
  \`preflight.css\` whether or not the component mentions the preference — as
  long as you imported the stylesheet barrel. A \`js\` driver (motion,
  \`requestAnimationFrame\`, a timer) is out of reach of every reset we ship and
  must gate itself.
- \`a11y.motion.declaresPreference\` — the file REFERENCES the preference. It is
  deliberately not called "honours": whether every animation inside is gated is
  not decidable by reading text, and one component here gated its list and not
  its list items. Treat it as necessary, never as sufficient.
- \`version\` / \`since\` / \`deprecated\` — the file you install is stamped with
  \`version\`; an upgrade diff reads it out of the banner.

## Live render of any documented state

\`${HOMEPAGE}/data/story-map.json\` maps each item to its Storybook story ids.
\`https://storybook.interlace.tools/iframe.html?id=<storyId>\` renders one — the
same render the accessibility gate asserts against, including the loading and
dark variants.

## Worked example — \`${example.raw.name}\`

\`\`\`
rendering    ${example.raw.meta?.client ? 'client' : 'server'}
minViewport  ${example.raw.meta?.minViewport ?? 'inherited'}
keyboard     ${
    example.keyboard.baseUi
      ? `Base UI ${example.keyboard.baseUi}`
      : example.keyboard.keys.join(', ') || 'none of its own'
  }
states       ${
    example.states.map((s) => `${s.name} = ${s.values.join(' | ')}`).join('\n             ') ||
    'none'
  }
exports      ${example.exports.join(', ')}
\`\`\`

${example.blurb}

## The rule

Never describe a component's behaviour from its name or its screenshot. Every
sentence you write about it should be traceable to a field above or to the
source header. If the contract does not say it, do not claim it.
`;
};

const buildSkills = (items, agentIndex) => {
  const files = [
    ['discover-interlace-components', skillDiscover(items, agentIndex)],
    ['install-interlace-component', skillInstall(items, agentIndex)],
    ['read-interlace-contract', skillContract(items)],
  ];
  const manifest = {
    schemaVersion: 'agent-skills/1',
    $comment:
      'GENERATED by apps/registry/scripts/build-agent-surface.mjs. Do not edit.',
    name: 'interlace-ui',
    title: 'Interlace Design System',
    description: `A ${items.length}-item shadcn-protocol registry of React components that publish their own contract: RSC boundary, minimum viewport, keyboard path, state union and semver.`,
    homepage: HOMEPAGE,
    license: 'MIT',
    llmsTxt: `${HOMEPAGE}/llms.txt`,
    index: `${HOMEPAGE}/data/agent-index.json`,
    registry: `${HOMEPAGE}/r/registry.json`,
    skills: files.map(([id, body]) => ({
      id,
      name: /^name:\s*(.+)$/m.exec(body)[1],
      description: /^description:\s*([\s\S]*?)\nlicense:/m
        .exec(body)[1]
        .replace(/\s+/g, ' ')
        .trim(),
      url: `${HOMEPAGE}/.well-known/agent-skills/${id}/SKILL.md`,
      path: `.well-known/agent-skills/${id}/SKILL.md`,
    })),
    capabilities: [
      'discover items by contract (rendering boundary, minViewport, keyboard, state union, loading state)',
      'read one item’s full contract, props and source before generating code',
      'install an item with the shadcn CLI, including its transitive registry dependencies',
    ],
  };
  return { manifest, files };
};

// ─────────────────────────────────────────────────────────────────────────────
// Emit
// ─────────────────────────────────────────────────────────────────────────────

const json = (value) => `${JSON.stringify(value, null, 2)}\n`;

const emit = async (artefacts) => {
  const errors = [];
  for (const [rel, content] of artefacts) {
    const abs = path.join(PUBLIC_DIR, rel);
    if (CHECK_ONLY) {
      const onDisk = await readFile(abs, 'utf8').catch(() => null);
      if (onDisk === null) errors.push(`${rel}: missing — run \`npm run agents:build\``);
      else if (onDisk !== content)
        errors.push(`${rel}: stale — run \`npm run agents:build\``);
      continue;
    }
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, content, 'utf8');
  }
  return errors;
};

const main = async () => {
  const items = await readItems();
  if (items.length === 0) {
    console.error(
      'build-agent-surface: no registry items in public/r — run build-registry.mjs first.',
    );
    process.exit(1);
  }

  const termData = buildTerms(items);
  const agentIndex = buildAgentIndex(items);
  const searchIndex = buildSearchIndex(items, termData);
  const { manifest, files } = buildSkills(items, agentIndex);

  const artefacts = [
    ['llms.txt', buildLlmsTxt(items, agentIndex)],
    ['data/agent-index.json', json(agentIndex)],
    ['data/search-index.json', json(searchIndex)],
    ['.well-known/agent-skills/index.json', json(manifest)],
    ...files.map(([id, body]) => [`.well-known/agent-skills/${id}/SKILL.md`, body]),
  ];

  const errors = await emit(artefacts);
  if (errors.length) {
    console.error('Agent-surface drift detected:\n  ' + errors.join('\n  '));
    process.exit(1);
  }

  const label = CHECK_ONLY ? 'OK —' : 'build-agent-surface:';
  console.log(
    `${label} ${items.length} items → llms.txt, agent-index.json, search-index.json (${termData.df.size} stems), ${files.length} skills` +
      (CHECK_ONLY ? ' match on-disk.' : ` → ${path.relative(REPO_ROOT, PUBLIC_DIR)}`),
  );
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
