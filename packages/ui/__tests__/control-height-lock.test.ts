/**
 * Control height lock — one-line controls take their height from the
 * --spacing-control-* tokens (structure/layout.css), so a consumer can
 * re-point one variable, or set data-density="comfortable", and every
 * Button, Input, Select, Toggle and Tab list grows to a 44px target together.
 * A literal h-9 on one of them would leave it behind at 36px.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

const CONTROLS = [
  'src/primitives/button-variants.ts',
  'src/primitives/input.tsx',
  'src/primitives/select.tsx',
  'src/primitives/combobox.tsx',
  'src/primitives/toggle.tsx',
  'src/primitives/tabs.tsx',
  'src/primitives/number-field.tsx',
  'src/primitives/theme-switcher.tsx',
  'src/primitives/toolbar.tsx',
  'src/primitives/pagination.tsx',
];

/**
 * Fixed sizes that are deliberate. The chip remove button sits inside a chip,
 * at exactly the 24px SC 2.5.8 floor, and must not grow with the controls.
 */
const ALLOWED: Record<string, string[]> = {
  'src/primitives/combobox.tsx': ['size-6'],
};

/** Fixed heights that match a control step: 24, 32, 36 and 40px. */
const LITERAL = /(?<![\w-])(?:h|size)-(?:6|8|9|10)(?![\w.-])/g;

describe('control height lock', () => {
  it('declares the four control steps, compact by default', () => {
    const css = read('styles/structure/layout.css');
    expect(css).toMatch(/--spacing-control-xs:\s*1\.5rem/);
    expect(css).toMatch(/--spacing-control-sm:\s*2rem/);
    expect(css).toMatch(/--spacing-control:\s*2\.25rem/);
    expect(css).toMatch(/--spacing-control-lg:\s*2\.5rem/);
  });

  it('gives comfortable density a 44px default control', () => {
    const css = read('styles/structure/layout.css');
    const block = css.slice(css.indexOf("[data-density='comfortable']"));
    expect(block).toMatch(/--spacing-control:\s*2\.75rem/);
  });

  it.each(CONTROLS)('%s sizes its controls from the tokens', (path) => {
    const src = read(path);
    expect(src).toMatch(/(?:h|size)-control/);
    // Comments may mention the old literals; class strings may not.
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    const strings = code.match(/(['"`])(?:(?!\1)[\s\S])*\1/g) ?? [];
    const allowed = ALLOWED[path] ?? [];
    const hits = strings
      .flatMap((s) => s.match(LITERAL) ?? [])
      .filter((hit) => !allowed.includes(hit));
    expect(hits, `${path} still uses fixed control heights`).toEqual([]);
  });
});
