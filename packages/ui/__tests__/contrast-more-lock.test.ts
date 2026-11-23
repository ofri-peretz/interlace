/**
 * More-contrast lock: the more-contrast block at the end of styles/semantics.css is an AAA reading mode layered on
 * every theme. This recomputes, for each theme in both schemes, every pair the
 * mode promises: text at 7:1 (WCAG 1.4.6, AAA) and lines at 3:1 (1.4.11).
 * It also holds the two copies of the token block (the data-contrast="more"
 * switch and the prefers-contrast media query) to the same declarations, so
 * the automatic mode can never drift from the opt-in one.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { contrast, parseColor, type RGB } from './color-math.js';
import { SCHEMES, THEMES, type Scheme } from '../src/lib/theme-tokens.js';

const STYLES = resolve(__dirname, '../styles');
const CSS = readFileSync(resolve(STYLES, 'semantics.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

const AAA_TEXT = 7;
const NON_TEXT = 3;

/** Where each theme × scheme lives (the same matrix theme-contract-lock pins). */
const SOURCES: Record<string, Record<Scheme, { file: string; selector: string }>> = {
  interlace: {
    light: { file: 'brand/interlace.css', selector: ":root,\n  [data-scheme='light']" },
    dark: { file: 'brand/interlace.css', selector: ".dark,\n  [data-scheme='dark']" },
  },
  harbor: {
    light: {
      file: 'brand/harbor.css',
      selector: "[data-theme='harbor'],\n  [data-theme='harbor'] [data-scheme='light']",
    },
    dark: {
      file: 'brand/harbor.css',
      selector:
        "[data-theme='harbor'].dark,\n  [data-theme='harbor'][data-scheme='dark'],\n" +
        "  [data-theme='harbor'] .dark,\n  [data-theme='harbor'] [data-scheme='dark']",
    },
  },
};

function block(css: string, selector: string): string {
  const at = css.indexOf(`${selector} {`);
  if (at < 0) throw new Error(`missing selector ${selector}`);
  const open = css.indexOf('{', at);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}' && --depth === 0) return css.slice(open + 1, i);
  }
  throw new Error('unbalanced');
}

function declarations(body: string, prefix: string): Map<string, string> {
  const out = new Map<string, string>();
  const re = new RegExp(`${prefix}([a-z0-9-]+)\\s*:\\s*([^;]+);`, 'g');
  for (const m of body.matchAll(re)) out.set(m[1]!, m[2]!.trim());
  return out;
}

const OPT_IN = declarations(
  block(CSS, "[data-contrast='more'],\n  [data-contrast='more'] :is(.dark, [data-scheme], [data-theme])"),
  '--',
);
const AUTOMATIC = declarations(
  block(
    CSS,
    ":root:not([data-contrast='normal']),\n    :root:not([data-contrast='normal']) :is(.dark, [data-scheme], [data-theme])",
  ),
  '--',
);

function brand(theme: string, scheme: Scheme): Map<string, string> {
  const src = SOURCES[theme]![scheme];
  const css = readFileSync(resolve(STYLES, src.file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  return declarations(block(css, src.selector), '--interlace-');
}

/** Resolves the mode's value for `token` on top of one theme × scheme. */
function resolver(theme: string, scheme: Scheme) {
  const raw = brand(theme, scheme);
  const brandColor = (name: string, seen = new Set<string>()): RGB => {
    if (seen.has(name)) throw new Error(`cycle at ${name}`);
    seen.add(name);
    const value = raw.get(name);
    if (!value) throw new Error(`${theme}/${scheme} has no --interlace-${name}`);
    const alias = /^var\(--interlace-([a-z0-9-]+)\)$/.exec(value);
    if (alias) return brandColor(alias[1]!, seen);
    const rgb = parseColor(value);
    if (!rgb) throw new Error(`cannot parse ${value}`);
    return rgb;
  };
  const term = (expr: string): RGB => {
    const v = /^var\(--(interlace-)?([a-z0-9-]+)\)$/.exec(expr.trim());
    if (!v) throw new Error(`unsupported term ${expr}`);
    return v[1] ? brandColor(v[2]!) : color(v[2]!);
  };
  const color = (token: string): RGB => {
    const value = OPT_IN.get(token);
    if (value === undefined) return brandColor(token);
    const mix = /^color-mix\(in srgb,\s*(var\([^)]+\))\s+(\d+)%,\s*(var\([^)]+\))\)$/.exec(value);
    if (mix) {
      const a = term(mix[1]!);
      const b = term(mix[3]!);
      const p = Number(mix[2]) / 100;
      return [0, 1, 2].map((i) => Math.round(a[i]! * p + b[i]! * (1 - p))) as RGB;
    }
    return term(value);
  };
  return color;
}

const TEXT: [string, string][] = [
  ['foreground', 'background'],
  ['card-foreground', 'card'],
  ['popover-foreground', 'popover'],
  ['muted-foreground', 'background'],
  ['muted-foreground', 'card'],
  ['muted-foreground', 'muted'],
  ['accent-foreground', 'accent'],
  ['secondary-foreground', 'secondary'],
  ['primary-foreground', 'primary'],
  ['primary', 'background'],
];
const TONES = ['destructive', 'success', 'warning', 'info', 'caution'];
for (const tone of TONES) {
  TEXT.push([tone, 'background'], [tone, 'card'], [`${tone}-foreground`, tone]);
}
const LINES: [string, string][] = [
  ['border', 'background'],
  ['input', 'background'],
  ['input', 'card'],
  ['ring', 'background'],
  ['ring', 'card'],
];

describe('more-contrast lock', () => {
  it('declares the same tokens for the opt-in switch and the system preference', () => {
    expect(OPT_IN.size).toBeGreaterThan(20);
    expect([...AUTOMATIC]).toEqual([...OPT_IN]);
  });

  it('covers every registered theme', () => {
    expect(Object.keys(SOURCES).sort()).toEqual(THEMES.map((t) => t.name).sort());
  });

  for (const theme of Object.keys(SOURCES)) {
    for (const scheme of SCHEMES) {
      it(`${theme} · ${scheme}: text clears 7:1 and lines clear 3:1`, () => {
        const color = resolver(theme, scheme);
        const misses = [
          ...TEXT.map(([fg, bg]) => [fg, bg, AAA_TEXT] as const),
          ...LINES.map(([fg, bg]) => [fg, bg, NON_TEXT] as const),
        ]
          .map(([fg, bg, floor]) => ({ fg, bg, floor, ratio: contrast(color(fg), color(bg)) }))
          .filter((p) => p.ratio < p.floor)
          .map((p) => `${p.fg} on ${p.bg}: ${p.ratio.toFixed(2)} < ${p.floor}`);
        expect(misses).toEqual([]);
      });
    }
  }
});
