import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Measured AA contrast lock for every tinted chip on the storefront.
 *
 * WHAT THIS REPLACED, AND WHY
 * ---------------------------
 * The previous lock (`badge-contrast-lock.test.ts`) asserted a RUNG: "no
 * light-mode hue text lighter than -700". It said so explicitly — "this
 * asserts the rung rather than the ratio because recomputing contrast needs a
 * browser". That premise was wrong twice over:
 *
 *  1. Contrast does not need a browser. It needs the token values and the
 *     sRGB luminance formula, and both are right here on disk. This file
 *     computes the real number.
 *  2. The rung was derived over pure white. `--background` is only white in
 *     ONE of the four (theme × scheme) combinations we ship. Harbor's light
 *     page surface is #f7f9fb, and on it `text-amber-700` over `bg-amber-500/10`
 *     measures 4.44:1 — under the 4.5:1 AA floor. The rung lock was green
 *     while the page was failing.
 *
 * A lock that encodes a conclusion goes stale the moment the inputs move. This
 * one re-derives from the shipped CSS every run, so adding a theme, retuning a
 * brand hex, or adding a chip hue is caught by the same assertion.
 *
 * WHAT IT MEASURES
 * ----------------
 * The chip recipe is `bg-<X>/<a>` + `text-<X>` on one element: the label sits
 * on an alpha tint of its OWN colour over the page surface. That composite is
 * the colour a user actually sees and it is nowhere in the theme file's own
 * contrast tables, which measure solid tokens on solid surfaces.
 *
 * Every chip is measured on all 8 surfaces we ship:
 *   {interlace, harbor} × {light, dark} × {--background, --card}
 * — both surfaces because a chip renders on the bare page AND inside a Card,
 * and in dark mode those are different colours.
 *
 * WHAT IT DOES NOT ASSERT
 * -----------------------
 * The `border-<X>/40` ring. It composites to ~1.7–3.0:1 against the surface,
 * which is below the 3:1 of SC 1.4.11 — but that criterion covers visual
 * information "required to identify" a component or its state, and these chips
 * carry a text label doing exactly that. The ring is decoration on top of an
 * already-sufficient signal, so it is out of scope rather than waived. If a
 * chip ever loses its text label, this exemption dies with it.
 */

const SRC = resolve(__dirname, '..');
const REPO = resolve(__dirname, '../../../..');
const UI_STYLES = resolve(REPO, 'packages/ui/styles');

/** WCAG 2.2 AA floor for normal body text. */
const AA_NORMAL = 4.5;

/* ── Colour maths ───────────────────────────────────────────────────────── */

type Rgb = readonly [number, number, number];

const hslToRgb = (h: number, s: number, l: number): Rgb => {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const t = [
    [c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x],
  ][Math.floor(h / 60) % 6] as number[];
  return t.map((v) => Math.round((v + m) * 255)) as unknown as Rgb;
};

/** OKLCH → OKLab → linear sRGB → gamma sRGB (Ottosson's matrices). */
const oklchToRgb = (L: number, C: number, hDeg: number): Rgb => {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((c) => {
    const g = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
    return Math.max(0, Math.min(255, Math.round(g * 255)));
  }) as unknown as Rgb;
};

const parseColor = (raw: string): Rgb | null => {
  const v = raw.trim();
  let m = /^#([0-9a-f]{6})$/i.exec(v);
  if (m) {
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  m = /^hsla?\(\s*([\d.]+)[deg\s,]+([\d.]+)%[\s,]+([\d.]+)%/i.exec(v);
  if (m) return hslToRgb(+m[1], +m[2] / 100, +m[3] / 100);
  m = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)/i.exec(v);
  if (m) return oklchToRgb(m[2] === '%' ? +m[1] / 100 : +m[1], +m[3], +m[4]);
  return null;
};

const channel = (c: number): number => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminance = ([r, g, b]: Rgb): number =>
  0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
const contrast = (a: Rgb, b: Rgb): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
/** Tailwind `bg-token/NN` — composite `fg` at `alpha` over an opaque `bg`. */
const over = (fg: Rgb, bg: Rgb, alpha: number): Rgb =>
  fg.map((c, i) => Math.round(c * alpha + bg[i] * (1 - alpha))) as unknown as Rgb;

/* ── Token sources ──────────────────────────────────────────────────────── */

const readLines = (p: string): string[] => readFileSync(p, 'utf8').split('\n');

/** Pull `--interlace-<name>: <value>;` out of one selector block. */
const parseBrandBlock = (lines: string[], startIdx: number): Record<string, string> => {
  const out: Record<string, string> = {};
  let depth = 0;
  for (let i = startIdx; i < lines.length; i += 1) {
    const line = lines[i];
    const m = /--interlace-([a-z0-9-]+)\s*:\s*([^;]+);/i.exec(line);
    if (m) out[m[1]] = m[2].trim();
    depth += (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length;
    if (i > startIdx && depth <= 0) break;
  }
  return out;
};

const findBlock = (lines: string[], selector: string): number => {
  const i = lines.findIndex((l) => l.trim().startsWith(selector));
  if (i < 0) throw new Error(`selector not found in CSS: ${selector}`);
  // Walk forward to the line that actually opens the block.
  for (let j = i; j < lines.length; j += 1) if (lines[j].includes('{')) return j;
  throw new Error(`no opening brace after ${selector}`);
};

const interlaceCss = readLines(resolve(UI_STYLES, 'interlace-theme.css'));
const harborCss = readLines(resolve(UI_STYLES, 'themes/harbor.css'));

/**
 * The four (theme × scheme) combinations the storefront ships. Harbor's dark
 * block is keyed off its first selector; `parseBrandBlock` reads to the
 * matching close brace, so the selector list above it is irrelevant.
 */
const COMBOS: Record<string, Record<string, string>> = {
  'interlace · light': parseBrandBlock(interlaceCss, findBlock(interlaceCss, ':root')),
  'interlace · dark': parseBrandBlock(interlaceCss, findBlock(interlaceCss, '.dark,')),
  'harbor · light': parseBrandBlock(harborCss, findBlock(harborCss, "[data-theme='harbor'] {")),
  'harbor · dark': parseBrandBlock(harborCss, findBlock(harborCss, "[data-theme='harbor'].dark,")),
};

/** Tailwind's stock palette, straight out of the installed package. */
const TAILWIND: Record<string, string> = {};
{
  const css = readFileSync(resolve(REPO, 'node_modules/tailwindcss/theme.css'), 'utf8');
  for (const m of css.matchAll(/--color-([a-z]+-\d{2,3}):\s*([^;]+);/g)) {
    TAILWIND[m[1]] = m[2].trim();
  }
}

/**
 * Resolve a Tailwind colour name to RGB inside one combo.
 * Returns null for non-colour utility suffixes (`xs`, `center`, `mono`, …),
 * which is how the class scanner tells `text-success` from `text-xs`.
 */
const resolveColor = (name: string, combo: Record<string, string>): Rgb | null => {
  if (combo[name]) return parseColor(combo[name]);
  if (TAILWIND[name]) return parseColor(TAILWIND[name]);
  return null;
};

/* ── Chip recipe extraction ─────────────────────────────────────────────── */

const CHIP_FILES = [
  'components/category-badge.tsx',
  'components/min-viewport-badge.tsx',
  'components/client-server-badge.tsx',
];

type Recipe = {
  file: string;
  label: string;
  tint: string;
  alpha: number;
  lightText: string;
  darkText: string;
};

/**
 * Strip comments before scanning. The prose in these files quotes the very
 * class names it is documenting (`text-amber-700` etc.), and a lock that
 * measures its own changelog is a lock that fails for the wrong reason.
 */
const stripComments = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/**
 * Pull every `bg-<X>/<a>` + `text-<Y>` pair that shares a class string. Class
 * strings are the unit because that is the granularity at which the two
 * colours are guaranteed to land on the same element.
 */
const extractRecipes = (file: string): Recipe[] => {
  const source = stripComments(readFileSync(resolve(SRC, file), 'utf8'));
  const out: Recipe[] = [];
  for (const m of source.matchAll(/['"`]([^'"`\n]*\bbg-[^'"`\n]*)['"`]/g)) {
    const chunk = m[1];
    const tint = /(?:^|\s)bg-([a-z0-9-]+)\/(\d+)/.exec(chunk);
    if (!tint) continue;
    const light = /(?:^|\s)text-([a-z0-9-]+)(?=\s|$)/.exec(chunk);
    if (!light) continue;
    const dark = /(?:^|\s)dark:text-([a-z0-9-]+)(?=\s|$)/.exec(chunk);
    out.push({
      file,
      label: chunk.length > 54 ? `${chunk.slice(0, 54)}…` : chunk,
      tint: tint[1],
      alpha: Number(tint[2]) / 100,
      lightText: light[1],
      // No `dark:` pair means the token re-resolves per scheme — same name.
      darkText: dark ? dark[1] : light[1],
    });
  }
  return out;
};

const RECIPES = CHIP_FILES.flatMap(extractRecipes);

/* ── The lock ───────────────────────────────────────────────────────────── */

describe('storefront chip contrast', () => {
  it('finds a chip recipe in every chip file', () => {
    // Guards the scanner itself: a regex that silently matches nothing would
    // make every assertion below vacuously true.
    for (const file of CHIP_FILES) {
      expect(
        RECIPES.filter((r) => r.file === file).length,
        `${file}: scanner extracted no chip recipes — the class shape changed`,
      ).toBeGreaterThan(0);
    }
  });

  it('resolves all four theme × scheme combinations', () => {
    for (const [name, combo] of Object.entries(COMBOS)) {
      expect(combo.background, `${name}: no --interlace-background`).toBeTruthy();
      expect(combo.card, `${name}: no --interlace-card`).toBeTruthy();
    }
  });

  it('clears WCAG 2.2 AA (4.5:1) on every surface we ship', () => {
    const failures: string[] = [];

    for (const recipe of RECIPES) {
      for (const [comboName, combo] of Object.entries(COMBOS)) {
        const isDark = comboName.endsWith('dark');
        const textName = isDark ? recipe.darkText : recipe.lightText;

        for (const surfaceName of ['background', 'card'] as const) {
          const surface = parseColor(combo[surfaceName]);
          const text = resolveColor(textName, combo);
          const tint = resolveColor(recipe.tint, combo);
          // A non-colour suffix (`text-xs`) resolves to null — not a pair.
          if (!surface || !text || !tint) continue;

          const ratio = contrast(text, over(tint, surface, recipe.alpha));
          if (ratio < AA_NORMAL) {
            failures.push(
              `${recipe.file}  [${comboName} · ${surfaceName}]  ` +
                `text-${textName} on bg-${recipe.tint}/${recipe.alpha * 100} ` +
                `= ${ratio.toFixed(2)}:1  (need ${AA_NORMAL})\n    ${recipe.label}`,
            );
          }
        }
      }
    }

    expect(
      failures,
      `Chip label contrast below the AA floor:\n\n${failures.join('\n')}\n\n` +
        'Raise the text rung (or move to a semantic token) and re-run. Do not ' +
        'lower the floor — every one of these is a colour a user reads.',
    ).toEqual([]);
  });

  it('pairs every raw-hue light rung with a dark: counterpart', () => {
    // A token (`text-success`) re-resolves per scheme on its own. A raw hue
    // does not — a light-only hue silently inherits the page foreground in
    // dark mode, which is how a hue stops being a hue.
    const orphans = RECIPES.filter(
      (r) => /^[a-z]+-\d{2,3}$/.test(r.lightText) && r.darkText === r.lightText,
    ).map((r) => `${r.file}: text-${r.lightText} has no dark: counterpart`);

    expect(orphans, orphans.join('\n')).toEqual([]);
  });
});
