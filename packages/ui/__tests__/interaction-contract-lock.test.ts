/**
 * Interaction contract lock.
 *
 * The feel of the system comes from a few rules that no component test sees,
 * because jsdom computes no transition. They are held here, from source:
 *
 *   1. No `transition-all`. It animates layout properties nobody meant to
 *      animate (width, padding, inset) and makes every hover a full style
 *      recalc. Name the properties.
 *   2. Every overlay eases in with `ease-enter` and out with `ease-exit`, and
 *      leaves faster than it came: a dismissal the reader asked for should
 *      not linger.
 *   3. A pressable control answers a press: Button and Toggle scale to 0.97
 *      while pressed, behind `motion-safe:` so reduced motion keeps them
 *      still, and they time their feedback with the motion tokens.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(__dirname, '../src');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.(tsx?|css)$/.test(name) ? [path] : [];
  });
}

/** Source with comments removed, so a sentence that names a class does not count. */
function code(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

const files = walk(SRC).map((path) => ({ path: relative(SRC, path), text: code(path) }));

describe('interaction contract lock', () => {
  it('reads the source tree', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('never transitions every property', () => {
    const offenders = files.filter((f) => /\btransition-all\b/.test(f.text)).map((f) => f.path);
    expect(offenders, 'Name the properties: transition-[color,background-color,…]').toEqual([]);
  });

  it('eases every overlay in with ease-enter and out with ease-exit, out faster', () => {
    const overlays = files.filter((f) => /\banimate-out\b/.test(f.text));
    expect(overlays.length).toBeGreaterThanOrEqual(7);
    for (const f of overlays) {
      for (const chain of f.text.match(/'[^'\n]*\banimate-out\b[^'\n]*'/g) ?? []) {
        expect(chain, `${f.path}: an exit animation without ease-exit`).toMatch(/:ease-exit\b/);
        expect(chain, `${f.path}: an exit with no duration token`).toMatch(/:duration-\(--duration-(fast|base)\)/);
        expect(chain, `${f.path}: an entry without ease-enter`).toMatch(/(^|[\s'])(data-\[?open\]?:)?ease-enter\b/);
      }
    }
  });

  it.each(['primitives/button-variants.ts', 'primitives/toggle.tsx'])(
    '%s answers a press, still under reduced motion',
    (path) => {
      const f = files.find((x) => x.path === path)!;
      expect(f.text).toContain('motion-safe:active:scale-[0.97]');
      expect(f.text).not.toMatch(/(^|\s)active:scale-/);
      expect(f.text).toContain('duration-(--duration-fast)');
      expect(f.text).toContain('ease-enter');
    },
  );
});
