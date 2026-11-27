/**
 * WCAG 2.2 contrast in sRGB, the space React Native paints into.
 *
 * Native gets hex only (see scripts/build-tokens.mjs), so there is no oklch step here: a hex is
 * the pixel. `auditPalette` is exported so a consumer that brands a theme through overrides can
 * hold its own palette to the same floors in its own tests.
 */
import type { ColorToken, Palette } from './tokens.generated';

type RGB = [number, number, number];

/** `#rgb`, `#rrggbb` or `#rrggbbaa` (alpha ignored). Returns null for anything else. */
export function parseHex(hex: string): RGB | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(hex.trim());
  if (!m) return null;
  const h =
    m[1].length === 3
      ? m[1]
          .split('')
          .map((c) => c + c)
          .join('')
      : m[1].slice(0, 6);
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function luminance([r, g, b]: RGB): number {
  const [R, G, B] = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/**
 * `a` mixed with `b`, `amount` of `a` (0 to 1), channel by channel in sRGB: the same result as CSS
 * `color-mix(in srgb, a <amount>, b)`. Returns `#rrggbb`. Throws on a value that is not hex.
 */
export function mixHex(a: string, b: string, amount: number): string {
  const ca = parseHex(a);
  const cb = parseHex(b);
  if (!ca || !cb) throw new Error(`mixHex: not a hex colour: ${ca ? b : a}`);
  const channel = (i: number) => Math.round(ca[i] * amount + cb[i] * (1 - amount));
  return `#${[0, 1, 2].map((i) => channel(i).toString(16).padStart(2, '0')).join('')}`;
}

/** The WCAG contrast ratio of two hex colours, 1 to 21. Throws on a value that is not hex. */
export function contrastRatio(a: string, b: string): number {
  const ca = parseHex(a);
  const cb = parseHex(b);
  if (!ca || !cb) throw new Error(`contrastRatio: not a hex colour: ${ca ? b : a}`);
  const [hi, lo] = [luminance(ca), luminance(cb)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * The pairs a native component paints text (or a control boundary) with, and the floor each
 * must clear. Text is 4.5:1 (AA); a control's outline against the page is 3:1 (WCAG 1.4.11).
 */
export const CONTRAST_PAIRS: readonly { fg: ColorToken; bg: ColorToken; min: number }[] = [
  { fg: 'foreground', bg: 'background', min: 4.5 },
  { fg: 'cardForeground', bg: 'card', min: 4.5 },
  { fg: 'popoverForeground', bg: 'popover', min: 4.5 },
  { fg: 'mutedForeground', bg: 'muted', min: 4.5 },
  { fg: 'mutedForeground', bg: 'background', min: 4.5 },
  { fg: 'mutedForeground', bg: 'card', min: 4.5 },
  { fg: 'primary', bg: 'background', min: 4.5 },
  { fg: 'primary', bg: 'card', min: 4.5 },
  { fg: 'primaryForeground', bg: 'primary', min: 4.5 },
  { fg: 'primarySubtleForeground', bg: 'primarySubtle', min: 4.5 },
  { fg: 'secondaryForeground', bg: 'secondary', min: 4.5 },
  { fg: 'accentForeground', bg: 'accent', min: 4.5 },
  { fg: 'destructiveForeground', bg: 'destructive', min: 4.5 },
  { fg: 'successForeground', bg: 'success', min: 4.5 },
  { fg: 'warningForeground', bg: 'warning', min: 4.5 },
  { fg: 'infoForeground', bg: 'info', min: 4.5 },
  { fg: 'highlightForeground', bg: 'highlight', min: 4.5 },
  { fg: 'input', bg: 'background', min: 3 },
  { fg: 'ring', bg: 'background', min: 3 },
];

export type ContrastFailure = { fg: ColorToken; bg: ColorToken; ratio: number; min: number };

export type ContrastLevel = 'AA' | 'AAA';

/**
 * Every pair in `CONTRAST_PAIRS` that the palette fails. An empty list is a pass. At `AAA` text
 * pairs must reach 7:1; a control's outline stays at 3:1, because WCAG sets no higher floor there.
 */
export function auditPalette(palette: Palette, level: ContrastLevel = 'AA'): ContrastFailure[] {
  return CONTRAST_PAIRS.flatMap(({ fg, bg, min: aa }) => {
    const min = level === 'AAA' && aa === 4.5 ? 7 : aa;
    const ratio = contrastRatio(palette[fg], palette[bg]);
    return ratio + 1e-9 < min ? [{ fg, bg, min, ratio: Math.round(ratio * 100) / 100 }] : [];
  });
}
