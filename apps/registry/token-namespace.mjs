/**
 * The token-namespace collision surface, derived from the shipped stylesheets.
 *
 * ─── The problem this documents ───────────────────────────────────────────
 *
 * Tailwind v4's `@theme` directive does not scope anything. A key declared
 * there is a claim on a GLOBAL namespace, and when two stylesheets in one
 * build claim the same key exactly one registration survives. There is no
 * duplicate-key diagnostic, no build warning, and no runtime error — the
 * utility simply compiles against the other value.
 *
 * For an adopter the worst case is `--color-accent`. In shadcn's vocabulary
 * `accent` is the near-white HOVER SURFACE (`#fef4ed` light). In most design
 * systems "accent" means the brand highlight. A consumer whose `--color-accent`
 * is their brand colour, importing the Interlace baseline, gets a hover wash
 * where their brand colour used to be — white-on-white in the common case.
 * It fails at PAINT time, so nothing in their pipeline says a word: not tsc,
 * not the linter, not the build, not a test that renders to a DOM without
 * computing colour.
 *
 * And the obvious fix does not work either. Because the block is
 * `@theme inline`, `bg-accent` compiles to `var(--accent)` — the
 * `--color-accent` variable is never emitted and never read at runtime.
 * Redeclaring `--color-accent` in the consumer's `:root` changes nothing at
 * all, which is a uniquely frustrating way to spend an afternoon. The levers
 * that DO work are `--accent` (the semantics layer) and `--interlace-accent`
 * (the brand layer).
 *
 * ─── Why derived, not written down ────────────────────────────────────────
 *
 * A hand-maintained list of 100+ token names is wrong the first time someone
 * adds a token, and being wrong here is worse than being absent: an adopter
 * who checks the list, doesn't find their key, and ships is in exactly the
 * failure this page exists to prevent. So the NAMES are parsed out of the same
 * stylesheets the `theme` item ships, and only the JUDGEMENT — which of them
 * are traps and what to do instead — is authored.
 *
 * Consumed by:
 *   - `scripts/build-registry.mjs`  → the `theme` item's `docs`, which the
 *                                     shadcn CLI prints on install.
 *   - `/getting-started`            → before an adopter installs.
 *   - `/theme-authoring`            → when they start overriding tokens.
 */

import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STYLES_DIR = path.resolve(HERE, '../../packages/ui/styles');

/**
 * Every stylesheet in the DS except the barrel, discovered rather than listed.
 *
 * A hardcoded list would be one more thing to forget when a theme is added —
 * and a missing file here means a token silently absent from the published
 * collision list, which is worse than no list at all.
 */
const discoverStyleFiles = async () => {
  const top = (await readdir(STYLES_DIR, { withFileTypes: true }))
    .filter((e) => e.isFile() && e.name.endsWith('.css') && e.name !== 'index.css')
    .map((e) => e.name);
  const themes = await readdir(path.join(STYLES_DIR, 'themes')).catch(() => []);
  return [
    ...top.sort(),
    ...themes.filter((f) => f.endsWith('.css')).sort().map((f) => `themes/${f}`),
  ];
};

/**
 * Every custom property a `@theme` / `@theme inline` block claims.
 *
 * Brace-depth tracked rather than regex-scanned across the block: `@theme`
 * bodies contain `@keyframes name { from { … } }`, whose declarations are NOT
 * theme keys. Only depth-1 declarations count.
 */
export const parseThemeKeys = (css) => {
  const keys = [];
  const re = /@theme(\s+inline)?\s*\{/g;
  let m;
  while ((m = re.exec(css)) !== null) {
    const inline = Boolean(m[1]);
    let depth = 1;
    let i = re.lastIndex;
    // Text seen at depth 1 only. A nested `@keyframes x { from { … } }` is
    // skipped wholesale; its `@keyframes x` selector survives, which is
    // harmless because it holds no `--name:` declaration.
    let top = '';
    for (; i < css.length && depth > 0; i += 1) {
      const ch = css[i];
      if (ch === '{') {
        depth += 1;
      } else if (ch === '}') {
        depth -= 1;
      } else if (depth === 1) {
        top += ch;
      }
    }
    for (const [, name] of top.matchAll(/(--[\w-]+)\s*:/g)) {
      keys.push({ name, inline });
    }
    re.lastIndex = i;
  }
  return keys;
};

/** The namespace a theme key lands in — `--color-x` → `color`. */
const namespaceOf = (name) => name.replace(/^--/, '').split('-')[0];

/**
 * Read the stylesheets and group every claimed key.
 *
 * `files` is passed in rather than hardcoded so this stays in lock-step with
 * whatever `STYLE_FILES` the `theme` item actually ships.
 */
export const collectThemeClaims = async (files) => {
  const claims = [];
  for (const file of files ?? (await discoverStyleFiles())) {
    const css = await readFile(path.join(STYLES_DIR, file), 'utf8');
    for (const key of parseThemeKeys(css)) {
      claims.push({ ...key, file, namespace: namespaceOf(key.name) });
    }
  }
  return claims;
};

/**
 * The keys whose NAME reads as one thing and whose VALUE is another, or which
 * silently replace a Tailwind default the consumer never opted out of.
 *
 * Authored, not derived — this is judgement about blast radius, and there is
 * no way to compute "a consumer will assume this means their brand colour".
 * Each entry says what the adopter probably expects, what they actually get,
 * and the specific override that works.
 */
export const COLLISION_HAZARDS = [
  {
    token: '--color-accent',
    expected: 'the brand highlight colour',
    actual:
      'shadcn’s hover/selected SURFACE — #fef4ed light, #3d1a08 dark. 8:1 lighter than the brand orange beside it.',
    symptom:
      'Brand-coloured elements turn near-white. Fails at paint time; no build, type or lint error.',
    override: '--accent (semantics layer) or --interlace-accent (brand layer)',
  },
  {
    token: '--color-secondary',
    expected: 'a second brand colour',
    actual: 'a light grey surface — #f5f3f0 light.',
    symptom: 'Secondary buttons and badges lose their colour entirely.',
    override: '--secondary or --interlace-secondary',
  },
  {
    token: '--color-muted',
    expected: 'de-emphasised TEXT',
    actual: 'a background tint — #faf7f4 light.',
    symptom:
      'Near-white text on white. `--color-muted-foreground` is the text colour.',
    override: '--muted / --muted-foreground',
  },
  {
    token: '--color-border',
    expected: 'a visible divider',
    actual:
      '#eae7e2 — a deliberate 1.23:1 hairline. It is an intentional AA exemption here, so no contrast gate will flag it.',
    symptom: 'Dividers and card outlines effectively disappear.',
    override: '--border or --interlace-border',
  },
  {
    token: '--breakpoint-sm … --breakpoint-xl',
    expected: 'to be additive',
    actual:
      'a REPLACEMENT of Tailwind’s default ladder. `sm` moves 640px → 480px, and `2xl` stops existing.',
    symptom:
      'Every `2xl:` utility in the consumer’s existing code silently stops compiling.',
    override:
      'redeclare the full ladder — including `--breakpoint-2xl` — in your own @theme',
  },
  {
    token: '--spacing-xs … --spacing-2xl',
    expected: 'to affect padding and margin only',
    actual:
      'the `spacing` namespace also feeds `max-w-*` / `w-*` / `h-*` in Tailwind v4.',
    symptom:
      '`max-w-sm|md|lg|xl|2xl` resolve to 16/24/40/64/96px instead of 24/28/32/36/42rem — a 20× narrower container, with no error.',
    override: 'rename your own scale, or redeclare --spacing-* after the import',
  },
  {
    token: '--radius-sm / --radius-md / --radius-lg',
    expected: 'to be additive',
    actual: 'overrides Tailwind’s defaults — 2/6/8px becomes 8/12/16px.',
    symptom: 'Every `rounded-sm|md|lg` in the consumer’s app gets rounder.',
    override: 'redeclare --radius-* after the import',
  },
  {
    token: '--font-sans',
    expected: 'to be additive',
    actual: 'a full replacement of Tailwind’s default sans stack.',
    symptom: 'App-wide font change.',
    override: 'redeclare --font-sans after the import',
  },
];

/**
 * The one thing an adopter must understand before trying to fix a collision.
 * Repeated verbatim on every surface, because getting this wrong costs an hour
 * of editing a variable that nothing reads.
 */
export const INLINE_THEME_RULE =
  'The colour block is `@theme inline`, so Tailwind substitutes the value into the utility and never emits `--color-*` at runtime. `bg-accent` compiles to `var(--accent)`. Overriding `--color-accent` in your own `:root` therefore has NO effect — override `--accent` (semantics) or `--interlace-accent` (brand) instead.';

/** Cascade layers, in ascending priority — the supported override seam. */
export const OVERRIDE_RECIPE = `@import "tailwindcss";
@import "@interlace/ui/styles/index.css";

/* Declared AFTER the import, into the DS's own layer: wins regardless of
   source order or specificity, and survives a DS upgrade. */
@layer interlace.brand {
  :root { --interlace-accent: #0b5fff; }
}`;

/**
 * The collision section as Markdown, for the `theme` item's `docs` — i.e. the
 * text the shadcn CLI prints in the adopter's terminal at the exact moment
 * they have just installed the token layer.
 */
export const collisionMarkdown = (claims, homepage) => {
  const colour = claims.filter((c) => c.namespace === 'color');
  const other = claims.filter((c) => c.namespace !== 'color');
  const namespaces = [...new Set(other.map((c) => c.namespace))].sort();
  return [
    '### Token namespace — read this before you theme',
    '',
    `This baseline claims **${colour.length} \`--color-*\` keys** plus **${other.length} more** across the \`${namespaces.join('`, `')}\` namespaces. Tailwind v4 \`@theme\` keys are global: wherever your app claims the same key, exactly one registration wins — silently, with no diagnostic.`,
    '',
    ...COLLISION_HAZARDS.map(
      (h) =>
        `- \`${h.token}\` — you probably expect ${h.expected}; you get ${h.actual} ${h.symptom} Override \`${h.override}\`.`,
    ),
    '',
    INLINE_THEME_RULE,
    '',
    `Full list, per-token values and the migration checklist: ${homepage}/theme-authoring#token-namespace`,
  ].join('\n');
};
