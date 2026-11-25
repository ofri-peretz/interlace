import { describe, expect, it } from 'vitest';
import { auditPalette, contrastRatio, CONTRAST_PAIRS, parseHex } from '../src/contrast';
import { createTheme } from '../src/theme-model';
import { THEME_PALETTES } from '../src/tokens.generated';

describe('contrast maths', () => {
  it('parses short, long and alpha hex, and nothing else', () => {
    expect(parseHex('#fff')).toEqual([255, 255, 255]);
    expect(parseHex('#0038b8')).toEqual([0, 56, 184]);
    expect(parseHex('#0038b880')).toEqual([0, 56, 184]);
    expect(parseHex('oklch(0.5 0.1 40)')).toBeNull();
  });

  it('measures the WCAG extremes', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
    // Symmetric: order does not matter.
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(contrastRatio('#ffffff', '#777777'), 10);
  });

  it('throws on a colour it cannot read, naming it', () => {
    expect(() => contrastRatio('red', '#fff')).toThrow(/red/);
    expect(() => contrastRatio('#fff', 'blue')).toThrow(/blue/);
  });
});

describe('every built-in palette clears its floors', () => {
  for (const name of Object.keys(THEME_PALETTES) as (keyof typeof THEME_PALETTES)[]) {
    for (const scheme of ['light', 'dark'] as const) {
      it(`${name} ${scheme}`, () => {
        expect(auditPalette(createTheme({ theme: name, scheme }).colors)).toEqual([]);
      });
    }
  }
});

describe('auditPalette', () => {
  it('reports a consumer override that drops below the floor', () => {
    const colors = createTheme({ scheme: 'light', overrides: { light: { mutedForeground: '#bbbbbb' } } }).colors;
    const failures = auditPalette(colors);
    expect(failures.length).toBeGreaterThan(0);
    expect(failures[0]).toMatchObject({ fg: 'mutedForeground', min: 4.5 });
    expect(failures[0].ratio).toBeLessThan(4.5);
  });

  it('checks text at 4.5:1 and control boundaries at 3:1', () => {
    expect(new Set(CONTRAST_PAIRS.map((p) => p.min))).toEqual(new Set([4.5, 3]));
  });
});
