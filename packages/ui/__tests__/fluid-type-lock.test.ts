/**
 * The heading scale is fluid at the top (h1–h3) and fixed below. Whatever the
 * width, each level must stay larger than the next, or a phone shows two
 * levels at one size and the outline flattens.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(__dirname, '../styles/structure/type.css'), 'utf8');

/** The size in px at a viewport width, for a rem value or a clamp(min, a + b·vw, max). */
function size(level: string, width: number): number {
  const decl = css.match(new RegExp(`--text-${level}: ([^;]+);`))![1]!.trim();
  const fixed = decl.match(/^([\d.]+)rem$/);
  if (fixed) return Number(fixed[1]) * 16;
  const m = decl.match(/^clamp\(([\d.]+)rem, (.+), ([\d.]+)rem\)$/);
  expect(m, `${level} is a rem or a clamp`).not.toBeNull();
  const [min, max] = [Number(m![1]), Number(m![3])];
  // The preferred value: a rem term and a vw term, in either order.
  const rem = Number(m![2]!.match(/([\d.]+)rem/)![1]);
  const vw = Number(m![2]!.match(/([\d.]+)vw/)![1]);
  const [a, b] = [rem, vw];
  return Math.min(max * 16, Math.max(min * 16, a * 16 + (b / 100) * width));
}

describe('fluid heading scale', () => {
  it.each([320, 360, 480, 768, 1024, 1440])('every level is larger than the next at %ipx', (width) => {
    const levels = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
    for (let i = 0; i < levels.length - 1; i++) {
      expect(size(levels[i]!, width), `${levels[i]} > ${levels[i + 1]}`).toBeGreaterThan(size(levels[i + 1]!, width));
    }
  });

  it('body text never scales with the viewport', () => {
    for (const level of ['body', 'long', 'ui']) {
      expect(css.match(new RegExp(`--text-${level}: ([^;]+);`))![1]).not.toMatch(/vw|clamp/);
    }
  });
});
