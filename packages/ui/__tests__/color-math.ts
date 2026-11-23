/**
 * Colour maths shared by the contrast locks (composite-contrast-lock,
 * theme-contract-lock, decorative-contract-lock).
 *
 * The brand palette is authored in `oklch()`. Every lock measures contrast
 * in 8-bit sRGB, the space a browser paints into and the space WCAG's
 * relative luminance is defined in, so each value is converted the way a
 * browser converts it: OKLCH → OKLab → linear sRGB → gamma → 0–255.
 * `parses the palette exactly as Chromium paints it` in theme-contract-lock
 * pins this conversion against values measured in a real browser.
 */

export type RGB = [number, number, number];

export function parseHex(hex: string): RGB | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const h =
    m[1].length === 3
      ? m[1]
          .split('')
          .map((c) => c + c)
          .join('')
      : m[1];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** `oklch(L C H)` with L as 0–1 or a percentage, standard OKLab matrices (Björn Ottosson). */
export function parseOklch(value: string): RGB | null {
  const m = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)\s*\)$/i.exec(value.trim());
  if (!m) return null;
  const L = parseFloat(m[1]) / (m[2] ? 100 : 1);
  const [C, H] = [parseFloat(m[3]), parseFloat(m[4])];
  const hr = (H * Math.PI) / 180;
  const a = C * Math.cos(hr);
  const b = C * Math.sin(hr);
  const l3 = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m3 = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s3 = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin: RGB = [
    4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
    -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
    -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3,
  ];
  return lin.map((c) => {
    const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.max(c, 0) ** (1 / 2.4) - 0.055;
    return Math.round(Math.min(1, Math.max(0, v)) * 255);
  }) as RGB;
}

/** Any colour literal the brand layer may hold: hex or oklch. */
export function parseColor(value: string): RGB | null {
  return parseHex(value) ?? parseOklch(value);
}

/** The regex fragment that matches one such literal inside a declaration. */
export const COLOR_LITERAL = String.raw`#[0-9a-fA-F]{3,8}|oklch\([^)]*\)`;

export function toHex([r, g, b]: RGB): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** WCAG 2.x relative luminance. */
export function luminance([r, g, b]: RGB): number {
  const [rs, gs, bs] = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rs! + 0.7152 * gs! + 0.0722 * bs!;
}

export function contrast(a: RGB, b: RGB): number {
  const [la, lb] = [luminance(a), luminance(b)];
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
