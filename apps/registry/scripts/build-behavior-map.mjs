#!/usr/bin/env node
/**
 * Compile the BEHAVIOUR contract into `public/data/behavior-map.json`.
 *
 * Why this file exists (DESIGN-SYSTEM-PLAN.md §5.x): of the nine registries
 * benchmarked, exactly one documents behaviour at all, and **none** publishes
 * a keyboard path, a measured contrast table, an sr-only data equivalent or a
 * coverage number. This DS has all four — and until now every one of them was
 * locked in a test file where no visitor could see it.
 *
 * The rule that makes this worth shipping: **nothing here is authored.** Every
 * number and every keystroke is read out of the thing that enforces it, so a
 * behaviour that stops being true stops being published in the same commit.
 *
 *   keyboard path   ← `await step('…')` titles + `userEvent.keyboard('{Key}')`
 *                     calls inside the Storybook `play` functions the
 *                     `storybook (interactions)` gate runs
 *                     (apps/storybook/src/stories/**\/*.stories.tsx)
 *   escape lock     ← `KEYBOARD_DRIVEN` in
 *                     packages/ui/__tests__/overlay-nav-keyboard-lock.test.ts
 *   contrast pairs  ← `TEXT_PAIRS` / `NON_TEXT_PAIRS` / `TONES` parsed out of
 *                     packages/ui/__tests__/theme-contract-lock.test.ts, then
 *                     RE-MEASURED here against the shipped hexes in
 *                     packages/ui/styles/*.css — the same maths the lock runs,
 *                     so the site cannot show a ratio the gate would reject
 *   state union     ← `DATA_STATES` + `DATA_STATE_PRESENTATION` in
 *                     packages/ui/src/primitives/data-state-model.ts
 *   text equivalent ← the `sr-only` markers in the component's own source, as
 *                     shipped in public/r/<name>.json
 *   coverage        ← the `thresholds` + `include` globs in
 *                     packages/ui/vitest.config.ts. The glob is published with
 *                     the number: "100%" over two directories is a different
 *                     claim from "100%", and only one of them is true.
 *
 * Run with `--check` (CI, and `npm run build:check`) to fail on drift instead
 * of silently serving a stale contract.
 */

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REGISTRY_ROOT = path.resolve(SCRIPT_DIR, '..');
const REPO_ROOT = path.resolve(REGISTRY_ROOT, '..', '..');

const STORIES_DIR = path.join(REPO_ROOT, 'apps/storybook/src/stories');
const UI_ROOT = path.join(REPO_ROOT, 'packages/ui');
const KEYBOARD_LOCK = path.join(
  UI_ROOT,
  '__tests__/overlay-nav-keyboard-lock.test.ts',
);
const THEME_LOCK = path.join(UI_ROOT, '__tests__/theme-contract-lock.test.ts');
const DATA_STATE_MODEL = path.join(
  UI_ROOT,
  'src/primitives/data-state-model.ts',
);
const VITEST_CONFIG = path.join(UI_ROOT, 'vitest.config.ts');
const INTERLACE_CSS = path.join(UI_ROOT, 'styles/interlace-theme.css');
const HARBOR_CSS = path.join(UI_ROOT, 'styles/themes/harbor.css');
const PUBLIC_R = path.join(REGISTRY_ROOT, 'public/r');
const OUT_FILE = path.join(REGISTRY_ROOT, 'public/data/behavior-map.json');

const CHECK_ONLY = process.argv.includes('--check');

const rel = (p) => path.relative(REPO_ROOT, p);

/** Fail loudly. A generator that shrugs publishes a lie. */
const fail = (message) => {
  throw new Error(`build-behavior-map: ${message}`);
};

// ─── shared: registry-item key from a source filename ────────────────────────
// Verbatim from build-story-map.mjs so the two data files join on one key.
// Two passes so acronym runs split correctly: `CTASection` → `cta-section`.
const registryKey = (basename) =>
  basename
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();

/**
 * Story ids are RESOLVED out of `story-map.json`, never recomputed here.
 *
 * `build-story-map.mjs` owns Storybook's id algorithm, and it is subtler than
 * it looks — the export name goes through lodash `startCase` before it is
 * sanitized, so `KeyboardFlow` is `keyboard-flow`, not `keyboardflow`. A second
 * implementation of that in this file is a second thing to get wrong, and
 * getting it wrong is silent: a bad id renders an empty frame, not an error.
 * So this generator matches on the export name and takes whatever id the story
 * map already published for it.
 */
const idForExport = (entry, exportName) => {
  if (!entry) return null;
  const wanted = exportName.toLowerCase();
  return (
    entry.storyIds.find(
      (id) => (id.split('--')[1] ?? '').replace(/-/g, '') === wanted,
    ) ?? null
  );
};

// ─── 1. keyboard paths, out of the `play` functions ──────────────────────────

/**
 * Scan forward from `open` (index of a `(`) to its matching `)`, skipping
 * anything inside a string, template literal, comment or regex-ish `/…/`.
 *
 * Deliberately a scanner and not a JS parser: the failure mode of a scanner is
 * "runs off the end and throws", which fails the build. The failure mode of a
 * lenient parser is "returns a plausible half-step", which ships.
 */
const matchParen = (src, open) => {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      i++;
      while (i < src.length && src[i] !== quote) {
        if (src[i] === '\\') i++;
        i++;
      }
      continue;
    }
    if (c === '/' && src[i + 1] === '/') {
      i = src.indexOf('\n', i);
      if (i === -1) break;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      i = src.indexOf('*/', i);
      if (i === -1) break;
      i++;
      continue;
    }
    if (c === '(') depth++;
    else if (c === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
};

/** The first string literal in `text`, unescaped. `null` when there is none. */
const firstStringLiteral = (text) => {
  const m = /(['"])((?:\\.|(?!\1)[^\\])*)\1/s.exec(text);
  if (!m) return null;
  return m[2].replace(/\\(['"\\])/g, '$1').replace(/\s*\n\s*/g, ' ').trim();
};

/**
 * The keys a step actually presses, in order.
 *
 * `userEvent.keyboard('{ArrowDown}')` → `ArrowDown`; `userEvent.tab()` → `Tab`;
 * a bare `' '` argument → `Space`. Modifier syntax (`{Shift>}{F10}{/Shift}`)
 * collapses to the combination a human would be told to press.
 */
const keysInStep = (body) => {
  const keys = [];
  // `[, , arg]` — group 1 is the quote character, group 2 the literal's body.
  for (const [, , arg] of body.matchAll(
    /userEvent\.keyboard\(\s*(['"])((?:\\.|(?!\1)[^\\])*)\1/g,
  )) {
    let held = null;
    for (const [, brace, bare] of arg.matchAll(/\{([^}]*)\}|(\s)/g)) {
      if (bare === ' ') {
        keys.push('Space');
        continue;
      }
      if (brace === undefined) continue;
      if (brace.endsWith('>')) {
        held = brace.slice(0, -1);
        continue;
      }
      if (brace.startsWith('/')) {
        held = null;
        continue;
      }
      keys.push(held ? `${held}+${brace}` : brace);
    }
  }
  for (const _ of body.matchAll(/userEvent\.tab\(\s*\{\s*shift:\s*true/g)) {
    keys.push('Shift+Tab');
  }
  const plainTabs =
    (body.match(/userEvent\.tab\(\s*\)/g) ?? []).length;
  for (let i = 0; i < plainTabs; i++) keys.push('Tab');
  return keys;
};

/** Every `await step('title', async () => { … })` in source order. */
const parseSteps = (source, from, to) => {
  const steps = [];
  const region = source.slice(from, to);
  const re = /\bstep\s*\(/g;
  let m;
  while ((m = re.exec(region)) !== null) {
    const open = m.index + m[0].length - 1;
    const close = matchParen(region, open);
    if (close === -1) continue;
    const call = region.slice(open + 1, close);
    const title = firstStringLiteral(call);
    if (!title) continue;
    const bodyAt = call.indexOf(',');
    const body = bodyAt === -1 ? '' : call.slice(bodyAt);
    steps.push({ title, keys: keysInStep(body) });
    re.lastIndex = close;
  }
  return steps;
};

const walk = async (dir) => {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    /*
     * no-zip-slip flags any `path.join(dir, <name>)` — but these names come
     * from `readdir` on a repo-local directory, not from an archive, and the
     * containment assertion below is the check the rule asks for.
     */
    // eslint-disable-next-line node-security/no-zip-slip
    const full = path.join(dir, entry.name);
    if (!full.startsWith(STORIES_DIR + path.sep)) continue;
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else if (entry.name.endsWith('.stories.tsx')) out.push(full);
  }
  return out;
};

const TITLE_RE = /^\s*title:\s*['"]([^'"]+)['"]/m;

/**
 * `{ [registryKey]: { storyId, storyFile, export, steps } }`.
 *
 * A file may carry several `play` functions; the page shows ONE path, so the
 * one that presses the most keys wins. A story that only clicks is not a
 * keyboard path and is skipped entirely — publishing an interaction script
 * under the heading "Keyboard" would be exactly the kind of claim §5.x says
 * the market is already full of.
 */
const buildKeyboardPaths = async (storyMap) => {
  const files = (await walk(STORIES_DIR)).sort();
  const out = {};

  for (const file of files) {
    const source = await readFile(file, 'utf8');
    if (!source.includes('play:')) continue;
    const title = source.match(TITLE_RE)?.[1];
    if (!title) continue;

    const key = registryKey(path.basename(file, '.stories.tsx'));
    const entry = storyMap[key];
    // Not in the story map (a tier collision the map resolved elsewhere) —
    // there is no id to link, so there is nothing honest to publish.
    if (!entry) continue;

    // Slice the file at each `export const X: Story` so a `play` is attributed
    // to the story it belongs to rather than to whichever export came first.
    const exports = [
      ...source.matchAll(/^export\s+const\s+(\w+)\s*:\s*Story\b/gm),
    ].map((m) => ({ name: m[1], at: m.index }));

    let best = null;
    for (let i = 0; i < exports.length; i++) {
      const from = exports[i].at;
      const to = i + 1 < exports.length ? exports[i + 1].at : source.length;
      if (!source.slice(from, to).includes('play:')) continue;
      const steps = parseSteps(source, from, to);
      const keys = steps.reduce((n, s) => n + s.keys.length, 0);
      if (keys === 0) continue;
      const storyId = idForExport(entry, exports[i].name);
      if (!storyId) continue;
      const score = keys * 100 + steps.length;
      if (!best || score > best.score) {
        best = { score, export: exports[i].name, storyId, steps };
      }
    }

    if (!best) continue;
    out[key] = {
      storyId: best.storyId,
      storyExport: best.export,
      storyFile: rel(file),
      steps: best.steps,
    };
  }

  return out;
};

/** The primitives whose Escape path is locked, not merely exercised. */
const readEscapeLock = async () => {
  const src = await readFile(KEYBOARD_LOCK, 'utf8');
  const block = /const KEYBOARD_DRIVEN\s*=\s*\[([\s\S]*?)\]\s*as const;/.exec(
    src,
  );
  if (!block) fail(`KEYBOARD_DRIVEN no longer parses out of ${rel(KEYBOARD_LOCK)}`);
  const primitives = [
    ...block[1].matchAll(/primitive:\s*'([^']+)'/g),
  ].map((m) => m[1]);
  if (primitives.length === 0) fail('KEYBOARD_DRIVEN parsed to zero entries');

  const escapeBlock = /const MUST_ASSERT_ESCAPE\s*=\s*new Set\(\[([\s\S]*?)\]\)/.exec(
    src,
  );
  const escapeStories = escapeBlock
    ? [...escapeBlock[1].matchAll(/'([^']+)'/g)].map((m) => registryKey(m[1]))
    : [];

  return {
    file: rel(KEYBOARD_LOCK),
    primitives,
    // Intersected on purpose: `MUST_ASSERT_ESCAPE` currently names one story
    // (`ThemeSwitcher`) that is NOT in `KEYBOARD_DRIVEN`, so the lock's loop
    // never reaches it. Publishing that name would claim a gate that does not
    // run. See the note in the plan's §5.x — a lock is only what it executes.
    escape: escapeStories.filter((name) => primitives.includes(name)),
  };
};

// ─── 2. contrast, re-measured against the shipped hexes ──────────────────────

const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

const readBlock = (css, selector, file) => {
  const at = css.indexOf(`${selector} {`);
  if (at === -1) {
    fail(
      `selector \`${selector.replace(/\n/g, '\\n')}\` no longer appears in ` +
        `${rel(file)} — the theme/scheme matrix moved and this generator would ` +
        `otherwise publish an empty palette.`,
    );
  }
  const open = css.indexOf('{', at);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') {
      depth--;
      if (depth === 0) return stripComments(css.slice(open + 1, i));
    }
  }
  return fail(`unbalanced braces after \`${selector}\` in ${rel(file)}`);
};

const readDeclarations = (block) => {
  const out = new Map();
  for (const [, name, value] of block.matchAll(
    /--interlace-([a-z0-9-]+)\s*:\s*([^;]+);/g,
  )) {
    out.set(name, value.trim());
  }
  return out;
};

const resolveValue = (token, declarations, seen = new Set()) => {
  if (seen.has(token)) return undefined;
  seen.add(token);
  const raw = declarations.get(token);
  if (raw === undefined) return undefined;
  const alias = /^var\(\s*--interlace-([a-z0-9-]+)\s*\)$/.exec(raw);
  return alias ? resolveValue(alias[1], declarations, seen) : raw;
};

const parseHex = (hex) => {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return null;
  const h =
    m[1].length === 3
      ? m[1]
          .split('')
          .map((c) => c + c)
          .join('')
      : m[1];
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
};

const luminance = ([r, g, b]) => {
  const [rs, gs, bs] = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
};

const contrast = (a, b) => {
  const [la, lb] = [luminance(a), luminance(b)];
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
};

/** The selector matrix from `styles/interlace-theme.css`, in executable form. */
const THEME_SELECTORS = {
  interlace: {
    light: { file: INTERLACE_CSS, selector: ':root' },
    dark: { file: INTERLACE_CSS, selector: ".dark,\n  [data-scheme='dark']" },
  },
  harbor: {
    light: { file: HARBOR_CSS, selector: "[data-theme='harbor']" },
    dark: {
      file: HARBOR_CSS,
      selector:
        "[data-theme='harbor'].dark,\n  [data-theme='harbor'][data-scheme='dark'],\n" +
        "  [data-theme='harbor'] .dark,\n  [data-theme='harbor'] [data-scheme='dark']",
    },
  },
};

const readPalettes = async () => {
  const sources = new Map();
  for (const file of [INTERLACE_CSS, HARBOR_CSS]) {
    sources.set(file, await readFile(file, 'utf8'));
  }
  const palettes = {};
  for (const [theme, schemes] of Object.entries(THEME_SELECTORS)) {
    palettes[theme] = {};
    for (const [scheme, { file, selector }] of Object.entries(schemes)) {
      palettes[theme][scheme] = readDeclarations(
        readBlock(sources.get(file), selector, file),
      );
    }
  }
  return palettes;
};

/**
 * The pair table, parsed out of the lock rather than re-typed here. If a pair
 * is added to (or dropped from) the gate, this table moves with it.
 */
const readPairTable = async () => {
  const src = await readFile(THEME_LOCK, 'utf8');
  const floors = {};
  for (const [, name, value] of src.matchAll(
    /const (AA_TEXT|AA_NON_TEXT)\s*=\s*([\d.]+);/g,
  )) {
    floors[name] = Number(value);
  }
  if (floors.AA_TEXT === undefined || floors.AA_NON_TEXT === undefined) {
    fail(`AA_TEXT / AA_NON_TEXT no longer parse out of ${rel(THEME_LOCK)}`);
  }

  const readPairs = (constName, kind) => {
    const block = new RegExp(
      `const ${constName}: Pair\\[\\] = \\[([\\s\\S]*?)\\n\\];`,
    ).exec(src);
    if (!block) fail(`${constName} no longer parses out of ${rel(THEME_LOCK)}`);
    const pairs = [
      ...block[1].matchAll(
        /\{\s*fg:\s*'([^']+)',\s*bg:\s*'([^']+)',\s*floor:\s*(\w+),\s*why:\s*'([^']*)'/g,
      ),
    ].map(([, fg, bg, floorName, why]) => ({
      fg,
      bg,
      floor: floors[floorName],
      why,
      kind,
    }));
    if (pairs.length === 0) fail(`${constName} parsed to zero pairs`);
    return pairs;
  };

  const tonesBlock = /const TONES\s*=\s*\[([\s\S]*?)\]\s*as const;/.exec(src);
  if (!tonesBlock) fail(`TONES no longer parses out of ${rel(THEME_LOCK)}`);
  const tones = [...tonesBlock[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);

  const tonePairs = tones.flatMap((tone) => [
    {
      fg: `${tone}-foreground`,
      bg: tone,
      floor: floors.AA_TEXT,
      why: `copy on a ${tone} face`,
      kind: 'text',
    },
    {
      fg: tone,
      bg: 'background',
      floor: floors.AA_NON_TEXT,
      why: `${tone} tint on the page surface`,
      kind: 'non-text',
    },
    {
      fg: tone,
      bg: 'card',
      floor: floors.AA_NON_TEXT,
      why: `${tone} tint inside a card`,
      kind: 'non-text',
    },
  ]);

  return {
    file: rel(THEME_LOCK),
    floors,
    pairs: [
      ...readPairs('TEXT_PAIRS', 'text'),
      ...readPairs('NON_TEXT_PAIRS', 'non-text'),
      ...tonePairs,
    ],
  };
};

/** The theme × scheme columns, declared once so each pair carries 4 numbers. */
const buildMatrix = (palettes) =>
  Object.entries(palettes).flatMap(([theme, schemes]) =>
    Object.keys(schemes).map((scheme) => ({ theme, scheme })),
  );

/**
 * Measure one pair across every theme × scheme, as a positional array lined up
 * with `matrix`. `null` when a token does not resolve to a hex in some theme —
 * a half-measured row is not a measurement.
 */
const measurePair = (pair, palettes, matrix) => {
  const ratios = matrix.map(({ theme, scheme }) => {
    const declarations = palettes[theme][scheme];
    const fg = parseHex(resolveValue(pair.fg, declarations) ?? '');
    const bg = parseHex(resolveValue(pair.bg, declarations) ?? '');
    if (!fg || !bg) return null;
    return Math.round(contrast(fg, bg) * 100) / 100;
  });
  if (ratios.some((r) => r === null)) return null;
  const worst = Math.min(...ratios);
  return {
    fg: pair.fg,
    bg: pair.bg,
    kind: pair.kind,
    floor: pair.floor,
    why: pair.why,
    ratios,
    worst,
    worstAt: matrix[ratios.indexOf(worst)],
    passes: worst >= pair.floor,
  };
};

/**
 * Source with its comments removed.
 *
 * Every detection below reads the CODE, never the prose about the code. The
 * primitives carry long JSDoc headers full of example class strings, and
 * scanning those made `lib/cn.ts` — a nine-line `clsx` wrapper that renders
 * nothing — publish a measured contrast row for `foreground on background`.
 * A doc comment is not a usage.
 */
const stripCodeComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/**
 * The colour tokens a component's own source references, by utility prefix.
 *
 * Read off the source the install writes — not a hand-kept list — so a
 * component that stops using `--popover` stops claiming that pair.
 */
const tokensUsedBy = (source) => {
  const fg = new Set();
  const bg = new Set();
  for (const [, prefix, token] of source.matchAll(
    /\b(bg|text|border|ring|fill|stroke|decoration|from|to|via)-((?:[a-z][a-z0-9]*)(?:-[a-z0-9]+)*)\b/g,
  )) {
    if (prefix === 'bg' || prefix === 'from' || prefix === 'to' || prefix === 'via') {
      bg.add(token);
    } else {
      fg.add(token);
    }
  }
  return { fg, bg };
};

/** Surfaces a component sits on even when it declares no background itself. */
const IMPLICIT_SURFACES = ['background', 'card'];

const contrastFor = (source, pairTable, palettes, matrix) => {
  const { fg, bg } = tokensUsedBy(source);
  const rows = [];
  for (const pair of pairTable.pairs) {
    const usesFg = fg.has(pair.fg) || bg.has(pair.fg);
    if (!usesFg) continue;
    const usesBg = bg.has(pair.bg) || IMPLICIT_SURFACES.includes(pair.bg);
    if (!usesBg) continue;
    const measured = measurePair(pair, palettes, matrix);
    if (measured) rows.push(measured);
  }
  // Tightest first: the pair nearest its floor is the one a reader should
  // check, and burying it under a comfortable 15:1 is how a table stops being
  // read at all.
  rows.sort((a, b) => a.worst - b.worst);
  return rows;
};

// ─── 3. the state union ──────────────────────────────────────────────────────

const readDataStates = async () => {
  const src = await readFile(DATA_STATE_MODEL, 'utf8');
  const block = /export const DATA_STATES\s*=\s*\[([\s\S]*?)\]\s*as const;/.exec(
    src,
  );
  if (!block) fail(`DATA_STATES no longer parses out of ${rel(DATA_STATE_MODEL)}`);
  const names = [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  if (names.length === 0) fail('DATA_STATES parsed to zero members');

  const presentation = /export const DATA_STATE_PRESENTATION[\s\S]*?\n\};/.exec(
    src,
  );
  const readSet = (constName) => {
    const set = new RegExp(
      `export const ${constName}[\\s\\S]*?new Set[^\\[]*\\[([\\s\\S]*?)\\]`,
    ).exec(src);
    return set ? [...set[1].matchAll(/'([^']+)'/g)].map((m) => m[1]) : [];
  };
  const replacing = new Set(readSet('REPLACING_STATES'));
  const qualifying = new Set(readSet('QUALIFYING_STATES'));

  const states = names.map((name) => {
    const entry = presentation
      ? new RegExp(`'?${name}'?:\\s*\\{([\\s\\S]*?)\\n  \\},`).exec(
          presentation[0],
        )
      : null;
    const field = (key) => {
      if (!entry) return null;
      const m = new RegExp(`${key}:\\s*'([^']*)'`).exec(entry[1]);
      return m ? m[1] : null;
    };
    const flag = (key) => {
      if (!entry) return false;
      return new RegExp(`${key}:\\s*true`).test(entry[1]);
    };
    return {
      name,
      short: field('short'),
      glyph: field('glyph'),
      emphasis: field('emphasis'),
      hatch: flag('hatch'),
      dashed: flag('dashed'),
      // The two halves of the doctrine: a replacing state stands INSTEAD of the
      // body; a qualifying state stands NEXT to it and changes how to read it.
      role: replacing.has(name)
        ? 'replaces'
        : qualifying.has(name)
          ? 'qualifies'
          : 'none',
    };
  });

  return { file: rel(DATA_STATE_MODEL), states };
};

// ─── 4. text equivalent + coverage ───────────────────────────────────────────

/**
 * How a non-visual reader gets the DATA, not a description of the picture.
 *
 * Detected from the shipped source in four descending strengths, because
 * "has an aria-label" and "ships a real <table> of every value" are not the
 * same promise and must not render as the same sentence.
 */
const textAlternativeFor = (name, source) => {
  if (/data-slot="series-table"/.test(source)) {
    return {
      kind: 'series-table',
      detail:
        'This IS the shared sr-only table primitive — a real <table> with ' +
        '<caption> and scoped headers, rendered sr-only by default.',
    };
  }
  if (/<SeriesTable\b/.test(source)) {
    return {
      kind: 'series-table-consumer',
      detail:
        'Renders <SeriesTable> alongside the graphic: every plotted value is ' +
        'available as a real table row, sr-only by default.',
    };
  }
  if (/sr-only[\s\S]{0,400}?<table\b/.test(source)) {
    return {
      kind: 'sr-only-table',
      detail:
        'Ships an sr-only <table> carrying the same rows the graphic draws.',
    };
  }
  if (/className=\{?["'`][^"'`]*\bsr-only\b/.test(source)) {
    return {
      kind: 'sr-only-copy',
      // Deliberately weaker wording than the table cases above: sr-only copy
      // names something the visual carries by position, colour or icon alone.
      // It is not a data equivalent, and calling it one would be the claim
      // inflation this whole section exists to avoid.
      detail:
        'Ships sr-only copy for what the visual carries by position, colour ' +
        'or icon alone — a label, not a full data equivalent.',
    };
  }
  return { kind: null, detail: null };
};

const readCoverage = async () => {
  const src = await readFile(VITEST_CONFIG, 'utf8');
  // Scope to the `coverage: { … }` block. The file ALSO declares a top-level
  // `include` for which test files to run; reading that one published
  // "100% of __tests__/**", which is both meaningless and false.
  const at = src.indexOf('coverage: {');
  if (at === -1) fail(`no \`coverage: {\` block in ${rel(VITEST_CONFIG)}`);
  let depth = 0;
  let block = null;
  for (let i = src.indexOf('{', at); i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) {
        block = src.slice(at, i + 1);
        break;
      }
    }
  }
  if (!block) fail(`unbalanced braces in the coverage block of ${rel(VITEST_CONFIG)}`);

  const thresholds = /thresholds:\s*\{([^}]*)\}/.exec(block);
  if (!thresholds) fail(`coverage thresholds no longer parse out of ${rel(VITEST_CONFIG)}`);
  const numbers = Object.fromEntries(
    [...thresholds[1].matchAll(/(\w+):\s*(\d+)/g)].map(([, k, v]) => [
      k,
      Number(v),
    ]),
  );
  const include = /include:\s*\[([^\]]*)\]/.exec(block);
  const globs = include
    ? [...include[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
    : [];
  if (globs.length === 0) fail(`coverage \`include\` globs no longer parse out of ${rel(VITEST_CONFIG)}`);
  return { file: rel(VITEST_CONFIG), thresholds: numbers, include: globs };
};

/**
 * Where an item's shipped file actually lives in `packages/ui`.
 *
 * The registry path (`registry/interlace-ui/charts/time-series.tsx`) is a
 * publishing address, not a repo path, and the two only coincide for
 * primitives. Probed against the filesystem rather than assumed, because the
 * page renders this as a "source of truth" link and a confident 404 is worse
 * than no link.
 */
const SOURCE_ROOTS = [
  'packages/ui/src',
  'packages/ui/src/primitives',
  'packages/ui/src/blocks',
  'packages/ui',
];

const resolveSourcePath = async (registryPath) => {
  const rest = registryPath.replace(/^registry\/interlace-ui\//, '');
  for (const root of SOURCE_ROOTS) {
    const candidate = path.join(REPO_ROOT, root, rest);
    if (!candidate.startsWith(REPO_ROOT + path.sep)) continue;
    try {
      await readFile(candidate, 'utf8');
      return `${root}/${rest}`;
    } catch {
      // next candidate
    }
  }
  return null;
};

/** Does this item's source live inside the directories the gate covers? */
const inCoverageGate = (item, globs) =>
  (item.files ?? []).some((f) =>
    globs.some((glob) => {
      const dir = glob.split('/**')[0].replace(/^src\//, '');
      return f.path.includes(`/${dir}/`);
    }),
  );

// ─── assembly ────────────────────────────────────────────────────────────────

const INDEX_FILES = new Set(['index.json', 'registry.json']);

export const buildBehaviorMap = async () => {
  const storyMap = JSON.parse(
    await readFile(
      path.join(REGISTRY_ROOT, 'public/data/story-map.json'),
      'utf8',
    ),
  );

  const [keyboardPaths, escapeLock, pairTable, palettes, dataStates, coverage] =
    await Promise.all([
      buildKeyboardPaths(storyMap),
      readEscapeLock(),
      readPairTable(),
      readPalettes(),
      readDataStates(),
      readCoverage(),
    ]);

  const matrix = buildMatrix(palettes);

  const entries = (await readdir(PUBLIC_R))
    .filter((f) => f.endsWith('.json') && !INDEX_FILES.has(f))
    .sort();

  const components = {};
  for (const entry of entries) {
    const name = entry.replace(/\.json$/, '');
    const item = JSON.parse(
      // eslint-disable-next-line node-security/no-zip-slip
      await readFile(path.join(PUBLIC_R, entry), 'utf8'),
    );
    const raw = (item.files ?? []).map((f) => f.content ?? '').join('\n');
    if (!raw) continue;
    const source = stripCodeComments(raw);

    const keyboard = keyboardPaths[name] ?? null;
    const contrastRows = contrastFor(source, pairTable, palettes, matrix);
    const textAlternative = textAlternativeFor(name, source);
    const usesStateModel =
      /resolveDataState|announceDataState|data-state-model/.test(source);

    const firstFile = (item.files ?? [])[0];

    components[name] = {
      sourcePath: firstFile ? await resolveSourcePath(firstFile.path) : null,
      keyboard: keyboard
        ? { ...keyboard, escapeLocked: escapeLock.escape.includes(name) }
        : null,
      contrast: contrastRows,
      textAlternative,
      states: usesStateModel ? dataStates.states.map((s) => s.name) : [],
      coverage: {
        inGate: inCoverageGate(item, coverage.include),
      },
    };
  }

  return {
    generatedAt: new Date().toISOString(),
    sources: {
      keyboard: 'apps/storybook/src/stories/**/*.stories.tsx',
      keyboardLock: escapeLock.file,
      contrast: pairTable.file,
      themes: [rel(INTERLACE_CSS), rel(HARBOR_CSS)],
      dataStates: dataStates.file,
      coverage: coverage.file,
    },
    coverage,
    contrastFloors: pairTable.floors,
    /** The columns every `contrast[].ratios` array is aligned to. */
    matrix,
    dataStates: dataStates.states,
    components,
  };
};

// The timestamp is the one field that changes on every run, so `--check`
// compares everything else — otherwise the drift gate would fail on the clock.
const withoutTimestamp = (map) => {
  const { generatedAt: _generatedAt, ...rest } = map;
  return JSON.stringify(rest, null, 2);
};

const main = async () => {
  const map = await buildBehaviorMap();

  if (CHECK_ONLY) {
    let existing;
    try {
      existing = JSON.parse(await readFile(OUT_FILE, 'utf8'));
    } catch {
      console.error(
        `build-behavior-map --check: ${rel(OUT_FILE)} is missing. Run ` +
          '`node scripts/build-behavior-map.mjs`.',
      );
      process.exit(1);
    }
    if (withoutTimestamp(existing) !== withoutTimestamp(map)) {
      console.error(
        `build-behavior-map --check: ${rel(OUT_FILE)} is stale — the ` +
          'keyboard paths, contrast pairs, state union or coverage gate moved ' +
          'since it was generated. Run `node scripts/build-behavior-map.mjs` ' +
          'and commit the result.',
      );
      process.exit(1);
    }
    console.log('build-behavior-map --check: up to date');
    return;
  }

  await mkdir(path.dirname(OUT_FILE), { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(map, null, 2) + '\n', 'utf8');

  const withKeyboard = Object.values(map.components).filter(
    (c) => c.keyboard,
  ).length;
  // A wholesale break — the story-map key convention drifting, say — would
  // otherwise show up as a quietly emptier site rather than a failure.
  if (withKeyboard < 20) {
    fail(
      `only ${withKeyboard} components resolved a keyboard path (expected 20+). ` +
        'The story-map keys or the play-function shape moved.',
    );
  }
  const withContrast = Object.values(map.components).filter(
    (c) => c.contrast.length > 0,
  ).length;
  const withAlt = Object.values(map.components).filter(
    (c) => c.textAlternative.kind,
  ).length;
  console.log(
    `build-behavior-map: ${Object.keys(map.components).length} items — ` +
      `${withKeyboard} with a keyboard path, ${withContrast} with measured ` +
      `contrast, ${withAlt} with a text equivalent → ${rel(OUT_FILE)}`,
  );
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
