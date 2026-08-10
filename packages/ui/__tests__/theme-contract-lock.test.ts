/**
 * Theme contract lock — the machine-checked half of Phase 8.
 *
 * WHY THIS LOCK EXISTS
 * --------------------
 * A theme is a set of `--interlace-*` values scoped to a selector, and CSS
 * has no concept of "this set is incomplete". A theme that forgets
 * `--interlace-card` does not throw, does not warn, and does not fall back to
 * anything a reader would predict: the value resolves from whatever rule of
 * lower specificity last matched, which is the PREVIOUS theme in the cascade.
 * The page then renders 54 surfaces in the new brand and one in the old one —
 * a two-brand page nobody notices, because there is no symptom to notice, and
 * no user can name what is wrong well enough to file it.
 *
 * The same silence covers a typo. `--interlace-muted-forground: #4d453c`
 * declares a perfectly valid custom property that nothing reads, and the real
 * token keeps its inherited value. Nothing anywhere says a word.
 *
 * So the contract is checked from BOTH ends:
 *
 *   1. every registered theme defines EVERY token in `THEME_TOKENS`, in BOTH
 *      colour schemes                                       → nothing missing
 *   2. no theme defines a token OUTSIDE the manifest        → nothing extra
 *   3. every theme × scheme clears the WCAG 2.2 floors, RECOMPUTED here
 *      rather than read out of the comments                 → nothing eyeballed
 *
 * (3) is the one that matters most for a second theme. A palette can satisfy
 * the token contract perfectly and still be unreadable; "it looks fine on my
 * screen" is how #eae7e2 shipped as a form-control border at 1.23:1.
 *
 * WHAT THIS LOCK DOES NOT COVER
 * -----------------------------
 * Tinted composites (`bg-primary/10` + `text-primary`) — that is
 * `composite-contrast-lock`, which walks component source. This one only
 * knows about the palette. The two overlap by design on `--interlace-primary`
 * and disagree loudly if either drifts.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

import {
  SCHEMES,
  THEMES,
  THEME_TOKENS,
  type Scheme,
} from '../src/lib/theme-tokens.js';

const STYLES = resolve(__dirname, '../styles');
const INTERLACE_CSS = resolve(STYLES, 'interlace-theme.css');
const HARBOR_CSS = resolve(STYLES, 'themes/harbor.css');
const INDEX_CSS = resolve(STYLES, 'index.css');

/** WCAG 2.2 AA floors. */
const AA_TEXT = 4.5;
/** SC 1.4.11 (non-text contrast) + SC 2.4.13 (focus appearance). */
const AA_NON_TEXT = 3;

/**
 * Where each theme × scheme physically lives.
 *
 * This table IS the selector matrix from `styles/interlace-theme.css`, in
 * executable form:
 *
 *   :root                                        interlace · light
 *   .dark, [data-scheme='dark']                  interlace · dark
 *   [data-theme='X']                             theme X · light
 *   [data-theme='X'].dark, …[data-scheme='dark'] theme X · dark
 *
 * The selector strings are matched EXACTLY against the stylesheet, so a
 * refactor that changes how a scheme is keyed fails here rather than silently
 * parsing an empty block (which would make every assertion below vacuous).
 */
const THEME_SELECTORS: Record<string, Record<Scheme, { file: string; selector: string }>> = {
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

// ── CSS parsing ─────────────────────────────────────────────────────────

/** Drop `/* … *\/` so a token NAMED in prose is never read as declared. */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * The declaration body of `selector { … }`, by brace matching.
 *
 * Deliberately not a CSS parser: the failure mode of a hand-rolled matcher is
 * "throws / returns nothing", which fails the test. The failure mode of a
 * lenient parser is "returns something plausible", which passes it.
 */
function readBlock(file: string, selector: string): string {
  const css = readFileSync(file, 'utf8');
  const at = css.indexOf(`${selector} {`);
  expect(
    at,
    `Selector \`${selector}\` no longer appears in ${file}. This lock matches ` +
      `the stylesheet's selectors EXACTLY — if the theme/scheme matrix moved, ` +
      `update THEME_SELECTORS in the same change, or every assertion below ` +
      `starts passing vacuously.`,
  ).toBeGreaterThan(-1);

  const open = css.indexOf('{', at);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') {
      depth--;
      if (depth === 0) return stripComments(css.slice(open + 1, i));
    }
  }
  throw new Error(`Unbalanced braces after \`${selector}\` in ${file}`);
}

/** `--interlace-<name>: <value>;` pairs, in source order. */
function readDeclarations(block: string): Map<string, string> {
  const out = new Map<string, string>();
  const re = /--interlace-([a-z0-9-]+)\s*:\s*([^;]+);/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(block)) !== null) {
    out.set(match[1], match[2].trim());
  }
  return out;
}

/** Resolve `var(--interlace-x)` against the same block (e.g. `--ring`). */
function resolveValue(
  token: string,
  declarations: Map<string, string>,
  seen = new Set<string>(),
): string | undefined {
  if (seen.has(token)) return undefined; // cyclic alias — treat as unresolved
  seen.add(token);
  const raw = declarations.get(token);
  if (raw === undefined) return undefined;
  const alias = /^var\(\s*--interlace-([a-z0-9-]+)\s*\)$/.exec(raw);
  return alias ? resolveValue(alias[1], declarations, seen) : raw;
}

type Palette = Map<string, string>;

const PALETTES: Record<string, Record<Scheme, Palette>> = Object.fromEntries(
  Object.entries(THEME_SELECTORS).map(([theme, schemes]) => [
    theme,
    Object.fromEntries(
      SCHEMES.map((scheme) => [
        scheme,
        readDeclarations(readBlock(schemes[scheme].file, schemes[scheme].selector)),
      ]),
    ) as Record<Scheme, Palette>,
  ]),
);

// ── colour maths (same implementation as composite-contrast-lock) ───────

type RGB = [number, number, number];

function parseHex(hex: string): RGB | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
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
}

function luminance([r, g, b]: RGB): number {
  const [rs, gs, bs] = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrast(a: RGB, b: RGB): number {
  const [la, lb] = [luminance(a), luminance(b)];
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Lay `fg` over `bg` at `alpha` (0–1). Straight source-over compositing. */
function composite(fg: RGB, bg: RGB, alpha: number): RGB {
  return [0, 1, 2].map((i) =>
    Math.round(fg[i] * alpha + bg[i] * (1 - alpha)),
  ) as RGB;
}

// ── the pairs every theme owes ──────────────────────────────────────────

interface Pair {
  fg: string;
  bg: string;
  floor: number;
  why: string;
}

/**
 * Body text on a surface. Every one of these is a pair a component actually
 * renders — `text-muted-foreground` inside a Card, `text-warning` on the
 * page, a filled status chip. 4.5:1 is the AA floor for normal text; the DS
 * targets 7:1 (AAA) and the Storybook axe gate enforces the enhanced check,
 * but the LOCK holds the line at AA so a legitimate large-text-only token
 * cannot be blocked by a number WCAG does not require.
 */
const TEXT_PAIRS: Pair[] = [
  { fg: 'foreground', bg: 'background', floor: AA_TEXT, why: 'body copy' },
  { fg: 'card-foreground', bg: 'card', floor: AA_TEXT, why: 'copy in a card' },
  { fg: 'popover-foreground', bg: 'popover', floor: AA_TEXT, why: 'copy in a popover' },
  { fg: 'muted-foreground', bg: 'background', floor: AA_TEXT, why: 'secondary copy' },
  { fg: 'muted-foreground', bg: 'card', floor: AA_TEXT, why: 'secondary copy in a card' },
  { fg: 'muted-foreground', bg: 'muted', floor: AA_TEXT, why: 'copy on a muted surface' },
  { fg: 'secondary-foreground', bg: 'secondary', floor: AA_TEXT, why: 'secondary button face' },
  { fg: 'accent-foreground', bg: 'accent', floor: AA_TEXT, why: 'hover/highlight face' },
  { fg: 'primary-subtle-foreground', bg: 'primary-subtle', floor: AA_TEXT, why: 'brand-tinted chip' },
  { fg: 'hero-foreground', bg: 'hero-surface', floor: AA_TEXT, why: 'cosmic hero copy' },
  { fg: 'scrim-foreground', bg: 'scrim', floor: AA_TEXT, why: 'copy over an image scrim' },
];

/** Filled chips + status text, for every semantic tone. */
const TONES = ['primary', 'destructive', 'success', 'warning', 'info', 'caution'] as const;

/**
 * Non-text UI. This is the class of failure axe cannot see: it scores TEXT
 * against its background and never a control's BORDER against the surface
 * behind it, which is how `--input` at 1.23:1 and a 2.57:1 focus ring both
 * shipped behind a green axe run. Measured on the page AND on a card,
 * because a form lives in a card as often as it lives on the page.
 */
const NON_TEXT_PAIRS: Pair[] = [
  { fg: 'ring', bg: 'background', floor: AA_NON_TEXT, why: 'focus ring (SC 2.4.13)' },
  { fg: 'ring', bg: 'card', floor: AA_NON_TEXT, why: 'focus ring inside a card' },
  { fg: 'input', bg: 'background', floor: AA_NON_TEXT, why: 'control border (SC 1.4.11)' },
  { fg: 'input', bg: 'card', floor: AA_NON_TEXT, why: 'control border inside a card' },
  { fg: 'viz-axis', bg: 'background', floor: AA_NON_TEXT, why: 'chart axis (SC 1.4.11)' },
  { fg: 'viz-axis', bg: 'card', floor: AA_NON_TEXT, why: 'chart axis inside a card' },
];

function measure(palette: Palette, pair: Pair): number | null {
  const fg = parseHex(resolveValue(pair.fg, palette) ?? '');
  const bg = parseHex(resolveValue(pair.bg, palette) ?? '');
  if (!fg || !bg) return null;
  return contrast(fg, bg);
}

// ── the lock ────────────────────────────────────────────────────────────

describe('theme contract lock', () => {
  // ── the parser's own tests ───────────────────────────────────────────
  // Everything below rests on reading blocks out of CSS correctly. A parser
  // that quietly stopped matching would make every assertion pass vacuously,
  // so pin its behaviour — including its ability to FAIL — first.

  it('reads a block by exact selector and ignores prose inside comments', () => {
    const block = readBlock(INTERLACE_CSS, ':root');
    const declarations = readDeclarations(block);
    expect(declarations.get('primary')).toBe('#7d350c');
    expect(declarations.get('background')).toBe('#ffffff');
    // The `:root` block's comments name other tokens in prose (`--border`,
    // `--input`, `bg-primary/10`). None of them may parse as a declaration.
    expect(declarations.has('border')).toBe(true); // really declared
    expect(declarations.has('color-fd-muted-foreground')).toBe(false); // semantics layer
  });

  it('resolves var() aliases, and does not hang on a cycle', () => {
    const declarations = new Map([
      ['primary', '#123456'],
      ['ring', 'var(--interlace-primary)'],
      ['a', 'var(--interlace-b)'],
      ['b', 'var(--interlace-a)'],
    ]);
    expect(resolveValue('ring', declarations)).toBe('#123456');
    expect(resolveValue('a', declarations)).toBeUndefined();
    expect(resolveValue('nope', declarations)).toBeUndefined();
  });

  it('computes the ratios the theme files claim', () => {
    // Anchor the maths on two numbers written in the stylesheets by hand. If
    // this drifts, either the maths is wrong or the comments are fiction —
    // both worth failing over.
    const interlaceLight = PALETTES.interlace.light;
    expect(measure(interlaceLight, { fg: 'primary', bg: 'background', floor: 0, why: '' })!).toBeCloseTo(8.8, 1);
    const harborDark = PALETTES.harbor.dark;
    expect(measure(harborDark, { fg: 'primary', bg: 'background', floor: 0, why: '' })!).toBeCloseTo(10.03, 1);
  });

  it('would notice a token missing from a theme (negative control)', () => {
    // The whole lock is one set comparison; prove the comparison can fail,
    // because a green suite that cannot go red is decoration.
    const complete = new Set(THEME_TOKENS as readonly string[]);
    const broken = new Set(complete);
    broken.delete('card');
    expect([...complete].filter((t) => !broken.has(t))).toEqual(['card']);
  });

  // ── 1. provenance: the manifest IS the :root block ───────────────────

  it('THEME_TOKENS matches the :root block it is derived from, in order', () => {
    const derived = [...readDeclarations(readBlock(INTERLACE_CSS, ':root')).keys()];
    expect(
      derived,
      'THEME_TOKENS was derived from the `:root` block of interlace-theme.css ' +
        'and has drifted from it. Adding a brand token to the default theme ' +
        'without adding it to the manifest means no other theme is ever asked ' +
        'for it — which is exactly the silent-inheritance bug this file exists ' +
        'to prevent. Add it in both places.',
    ).toEqual([...THEME_TOKENS]);
  });

  it('every registered theme has a place to live in the stylesheet', () => {
    // THEMES (TS) and THEME_SELECTORS (CSS) are two lists that must not drift:
    // a theme registered in TS but absent from CSS renders as the default
    // while the switcher insists it is active.
    expect(Object.keys(THEME_SELECTORS).sort()).toEqual(
      THEMES.map((theme) => theme.name).slice().sort(),
    );
  });

  // ── 2. completeness, per theme × scheme ──────────────────────────────

  for (const theme of THEMES) {
    for (const scheme of SCHEMES) {
      describe(`${theme.name} · ${scheme}`, () => {
        const palette = PALETTES[theme.name][scheme];

        it('defines every token in THEME_TOKENS', () => {
          const missing = THEME_TOKENS.filter((token) => !palette.has(token));
          expect(
            missing,
            `${theme.name} · ${scheme} is missing ${missing.length} token(s).\n\n` +
              `A missing token does not throw — it silently inherits the value ` +
              `from whichever rule matched at lower specificity (the previous ` +
              `theme, or this theme's OTHER scheme), and ships a page painted ` +
              `in two brands at once.\n\n  ${missing.join('\n  ')}`,
          ).toEqual([]);
        });

        it('defines nothing outside THEME_TOKENS', () => {
          const known = new Set<string>(THEME_TOKENS);
          const extra = [...palette.keys()].filter((token) => !known.has(token));
          expect(
            extra,
            `${theme.name} · ${scheme} declares ${extra.length} token(s) that ` +
              `are not in the manifest. A typo is silent for the same reason a ` +
              `missing token is: \`--interlace-muted-forground\` is a valid ` +
              `custom property that nothing reads, and the real token keeps its ` +
              `inherited value.\n\n  ${extra.join('\n  ')}`,
          ).toEqual([]);
        });

        it('declares a value this lock can actually read', () => {
          // A token present with an unparseable value passes the completeness
          // check and fails the user. Hex / oklch / var-alias / rem length is
          // the whole vocabulary the brand layer is allowed.
          const bad: string[] = [];
          for (const token of THEME_TOKENS) {
            const value = resolveValue(token, palette);
            if (
              value === undefined ||
              !(
                /^#[0-9a-f]{3}$|^#[0-9a-f]{6}$/i.test(value) ||
                /^oklch\(/.test(value) ||
                /^[\d.]+rem$/.test(value)
              )
            ) {
              bad.push(`${token}: ${value ?? '<unresolved>'}`);
            }
          }
          expect(bad, `Unreadable brand values:\n  ${bad.join('\n  ')}`).toEqual([]);
        });

        // ── 3. contrast, recomputed ──────────────────────────────────────

        it('clears the AA floor for body text on every surface it paints', () => {
          const failures: string[] = [];
          const checked: string[] = [];

          const pairs: Pair[] = [
            ...TEXT_PAIRS,
            ...TONES.flatMap((tone) => [
              { fg: `${tone}-foreground`, bg: tone, floor: AA_TEXT, why: `filled ${tone} chip` },
              { fg: tone, bg: 'background', floor: AA_TEXT, why: `text-${tone} on the page` },
              { fg: tone, bg: 'card', floor: AA_TEXT, why: `text-${tone} in a card` },
            ]),
          ];

          for (const pair of pairs) {
            const ratio = measure(palette, pair);
            expect(
              ratio,
              `Could not measure ${pair.fg} on ${pair.bg} — one of them is not a ` +
                `hex value in ${theme.name} · ${scheme}.`,
            ).not.toBeNull();
            checked.push(`${pair.fg} on ${pair.bg}`);
            if (ratio! < pair.floor) {
              failures.push(
                `  ${pair.fg} on ${pair.bg} → ${ratio!.toFixed(2)}:1 ` +
                  `(needs ${pair.floor}:1 — ${pair.why})`,
              );
            }
          }

          expect(checked.length).toBeGreaterThan(20);
          expect(
            failures,
            `${theme.name} · ${scheme} has text below the WCAG 2.2 AA floor.\n\n` +
              `Fix by moving the FOREGROUND token, not the surface: a surface ` +
              `is shared by everything on it, a foreground is not.\n\n` +
              failures.join('\n'),
          ).toEqual([]);
        });

        it('clears the 3:1 floor for the focus ring and control borders', () => {
          const failures: string[] = [];
          for (const pair of NON_TEXT_PAIRS) {
            const ratio = measure(palette, pair);
            expect(ratio, `Could not measure ${pair.fg} on ${pair.bg}`).not.toBeNull();
            if (ratio! < pair.floor) {
              failures.push(
                `  ${pair.fg} on ${pair.bg} → ${ratio!.toFixed(2)}:1 ` +
                  `(needs ${pair.floor}:1 — ${pair.why})`,
              );
            }
          }
          expect(
            failures,
            `${theme.name} · ${scheme} has non-text UI below WCAG 2.2 SC 1.4.11 / ` +
              `SC 2.4.13.\n\nThis is the class axe cannot see: it scores text ` +
              `against its background and never a control's border against the ` +
              `surface behind it. An unfocusable-looking field and an invisible ` +
              `focus ring both pass a green axe run.\n\n` +
              failures.join('\n'),
          ).toEqual([]);
        });

        it('keeps the brand-tinted chip legible (bg-primary/10 + text-primary)', () => {
          // The binding constraint on the Interlace palette, documented in its
          // own header — and the pair most likely to be forgotten by a new
          // theme, because it is a colour nobody ever picked.
          const primary = parseHex(resolveValue('primary', palette) ?? '')!;
          const background = parseHex(resolveValue('background', palette) ?? '')!;
          const ratio = contrast(primary, composite(primary, background, 0.1));
          expect(
            ratio,
            `${theme.name} · ${scheme}: text-primary on bg-primary/10 measured ` +
              `${ratio.toFixed(2)}:1. The stock shadcn tinted-chip pattern is ` +
              `where a primary colour actually breaks — it clears the page and ` +
              `fails its own 10% tint.`,
          ).toBeGreaterThanOrEqual(AA_TEXT);
        });
      });
    }
  }

  // ── 4. the selector matrix itself ────────────────────────────────────

  describe('two-axis selector matrix', () => {
    const interlace = readFileSync(INTERLACE_CSS, 'utf8');
    const harbor = readFileSync(HARBOR_CSS, 'utf8');

    it('keys the SCHEME axis on `.dark` — the shadcn/next-themes convention', () => {
      // `.dark` is load-bearing: every consumer, and the Storybook
      // `withThemeByClassName` decorator (parentSelector: 'html'), writes it.
      // Breaking it to gain a cleaner name would be vanity.
      expect(interlace).toContain(".dark,\n  [data-scheme='dark']");
      expect(harbor).toContain("[data-theme='harbor'].dark");
    });

    it('claims the whole SUBTREE, not just the element it is set on', () => {
      // `.dark` in interlace-theme.css is unscoped, so it means "INTERLACE
      // dark": it re-declares every brand literal on whatever element carries
      // it. `[data-theme='X'].dark` needs both on the SAME element, so a
      // `<div class="dark">` inside a themed page silently repaints that
      // subtree in the default brand — a themed page with a default-branded
      // panel in the middle of it, which reads as "the theme did not apply".
      // Caught in a browser in 8.4; every theme owes the descendant forms.
      for (const [name, schemes] of Object.entries(THEME_SELECTORS)) {
        if (name === 'interlace') continue; // `:root` IS the default
        const css = stripComments(readFileSync(schemes.dark.file, 'utf8'));
        for (const form of [
          `[data-theme='${name}'].dark`,
          `[data-theme='${name}'] .dark`,
          `[data-theme='${name}'] [data-scheme='dark']`,
        ]) {
          expect(
            css,
            `Theme \`${name}\` does not declare its dark palette for \`${form}\`. ` +
              `Without every form, a dark region inside a ${name} page falls back ` +
              `to the DEFAULT brand's dark values.`,
          ).toContain(form);
        }
      }
    });

    it('no longer spends `data-theme` on the colour scheme', () => {
      // The Phase 8 correction. `[data-theme='dark']` used to MEAN dark mode,
      // which spent the one obvious attribute for "which brand" on "which
      // scheme" and left a second brand nowhere to go but a fork of the file.
      // Comments are stripped: the header documents the retired spelling on
      // purpose, and a migration note is not a selector.
      expect(stripComments(interlace)).not.toContain("[data-theme='dark']");
      expect(stripComments(harbor)).not.toContain("[data-theme='dark']");
    });

    it('re-binds the semantics layer on every brand-override selector', () => {
      // A `var()`-valued custom property is substituted on the element that
      // DECLARES it. If `--primary: var(--interlace-primary)` is bound only on
      // `:root`, a subtree that re-brands itself (`<div class="dark">`, which
      // is exactly what a side-by-side theme preview renders) changes the
      // brand token and nothing repaints.
      const semantics = interlace.slice(interlace.indexOf('@layer interlace.semantics'));
      expect(semantics).toContain(':root,\n  .dark,\n  [data-scheme=\'dark\'],\n  [data-theme]');
    });

    it('every theme file overrides ONLY the brand layer', () => {
      // The point of the cascade: a theme supplies hex, never semantics. A
      // theme that declares `--background` directly has bypassed the alias
      // graph, and the next token added to the graph will not reach it.
      const themeOnly = stripComments(harbor);
      expect(themeOnly).toContain('@layer interlace.brand');
      expect(themeOnly).not.toContain('@layer interlace.semantics');
      expect(themeOnly).not.toContain('@theme');
      const semanticDeclarations = themeOnly.match(/^\s*--(?!interlace-)[a-z]/gm);
      expect(
        semanticDeclarations,
        'A theme file declared a non-`--interlace-*` custom property. Themes ' +
          'own hex values; the semantics layer owns names.',
      ).toBeNull();
    });

    it('is wired into the canonical stylesheet, after the default theme', () => {
      // Order is load-bearing: `[data-theme='X']` and `.dark` are both
      // (0,1,0), so theme files must be imported AFTER interlace-theme.css.
      const index = readFileSync(INDEX_CSS, 'utf8');
      const base = index.indexOf('./interlace-theme.css');
      const theme = index.indexOf('./themes/harbor.css');
      expect(base).toBeGreaterThan(-1);
      expect(theme).toBeGreaterThan(base);
    });
  });
});
