import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error: a plain .mjs build script with no type declarations
import { NATIVE_COLOR_TOKENS, render } from '../scripts/build-tokens.mjs';
import { COLOR_TOKENS, THEME_PALETTES } from '../src/tokens.generated';

const ROOT = resolve(__dirname, '..', '..', '..');
const DTCG = JSON.parse(readFileSync(resolve(ROOT, 'apps/registry/public/tokens/interlace.tokens.json'), 'utf8'));

describe('native tokens are derived, not forked', () => {
  it('the committed file is exactly what the token file renders to', () => {
    const committed = readFileSync(resolve(__dirname, '..', 'src/tokens.generated.ts'), 'utf8');
    expect(committed).toBe(render(DTCG));
  });

  it('carries every theme the web registers, and no other', () => {
    const web = Object.keys(DTCG).filter((k) => !k.startsWith('$')).sort();
    expect(Object.keys(THEME_PALETTES).sort()).toEqual(web);
  });

  it('paints the same pixel as the web: primary hex matches the DTCG sRGB fallback', () => {
    expect(THEME_PALETTES.interlace.light.primary).toBe(DTCG.interlace.light.primary.$value.hex);
    expect(COLOR_TOKENS).toHaveLength(NATIVE_COLOR_TOKENS.length);
  });

  it('follows aliases and rejects what it cannot read', () => {
    // A one-theme token file where `ring` is set to the value under test.
    const tiny = (value: unknown, type = 'color') => {
      const scheme = (hex: string) =>
        Object.fromEntries(NATIVE_COLOR_TOKENS.map((n: string) => [n, { $type: 'color', $value: { hex } }]));
      const light: Record<string, unknown> = scheme('#000000');
      light.ring = { $type: type, $value: value };
      light.radius = { $type: 'dimension', $value: { value: 0.5, unit: 'rem' } };
      return { t: { light, dark: scheme('#ffffff') } };
    };
    expect(render(tiny('{t.dark.primary}'))).toContain("ring: '#ffffff'");
    expect(() => render(tiny('#nope'))).toThrow(/alias/);
    expect(() => render(tiny({ hex: 'oklch(1 0 0)' }))).toThrow(/hex/);
    expect(() => render(tiny('{t.light.ring}'))).toThrow(/cycle/);
    expect(() => render(tiny({}, 'dimension'))).toThrow(/not a color/);
    const noRem = tiny('#000000');
    (noRem.t.light as Record<string, unknown>).radius = { $type: 'dimension', $value: { value: 12, unit: 'px' } };
    expect(() => render(noRem)).toThrow(/rem/);
    const missing = tiny('#000000');
    delete (missing.t.light as Record<string, unknown>).primary;
    expect(() => render(missing)).toThrow(/missing/);
  });
});
