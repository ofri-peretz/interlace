import { describe, expect, it } from 'vitest';
import { createTheme, isNativeThemeName, resolveScheme } from '../src/theme-model';
import { CONTROL, MOTION, SPACE, TYPE, radii } from '../src/scale';
import { COLOR_TOKENS, THEME_PALETTES } from '../src/tokens.generated';

describe('resolveScheme', () => {
  it('lets an explicit choice win over the device', () => {
    expect(resolveScheme('dark', 'light')).toBe('dark');
    expect(resolveScheme('light', 'dark')).toBe('light');
  });

  it('follows the device under system, light when the device does not say', () => {
    expect(resolveScheme('system', 'dark')).toBe('dark');
    expect(resolveScheme('system', 'light')).toBe('light');
    expect(resolveScheme(undefined, null)).toBe('light');
    expect(resolveScheme('system', 'unspecified')).toBe('light');
  });
});

describe('createTheme', () => {
  it('defaults to the interlace palette and its radius', () => {
    const t = createTheme({ scheme: 'light' });
    expect(t.name).toBe('interlace');
    expect(t.colors).toEqual(THEME_PALETTES.interlace.light);
    expect(t.radius.lg).toBe(THEME_PALETTES.interlace.radius);
    expect(t.space).toBe(SPACE);
    expect(t.type).toBe(TYPE);
    expect(t.motion).toBe(MOTION);
    expect(t.control).toBe(CONTROL);
    expect(t.fonts).toEqual({});
  });

  it('builds every registered theme in both schemes with every token', () => {
    for (const name of Object.keys(THEME_PALETTES)) {
      expect(isNativeThemeName(name)).toBe(true);
      for (const scheme of ['light', 'dark'] as const) {
        const t = createTheme({ theme: name as keyof typeof THEME_PALETTES, scheme });
        expect(Object.keys(t.colors).sort()).toEqual([...COLOR_TOKENS].sort());
      }
    }
  });

  it('brands through overrides for the active scheme only, and ignores unknown keys', () => {
    const overrides = {
      light: { primary: '#0038b8', notAToken: '#ff0000' } as Record<string, string>,
      dark: { primary: '#8fb0ff' },
      radius: 10,
      fonts: { display: 'Serif Display' },
    };
    const light = createTheme({ scheme: 'light', overrides });
    const dark = createTheme({ scheme: 'dark', overrides });
    expect(light.colors.primary).toBe('#0038b8');
    expect(dark.colors.primary).toBe('#8fb0ff');
    expect(light.colors.background).toBe(THEME_PALETTES.interlace.light.background);
    expect('notAToken' in light.colors).toBe(false);
    expect(light.radius.lg).toBe(10);
    expect(light.fonts.display).toBe('Serif Display');
  });

  it('does not mutate the shared palette', () => {
    createTheme({ scheme: 'light', overrides: { light: { primary: '#000000' } } });
    expect(THEME_PALETTES.interlace.light.primary).not.toBe('#000000');
  });

  it('refuses an unknown theme name', () => {
    expect(isNativeThemeName('nope')).toBe(false);
    expect(isNativeThemeName(42)).toBe(false);
    // @ts-expect-error: a name outside the registry
    expect(() => createTheme({ theme: 'nope', scheme: 'light' })).toThrow(RangeError);
  });
});

describe('scales', () => {
  it('derives corners from the base radius, never below zero', () => {
    expect(radii(12)).toEqual({ none: 0, sm: 6, md: 9, lg: 12, xl: 18, full: 9999 });
    expect(radii(0).sm).toBe(0);
  });

  it('keeps every control at or above the 44pt touch target', () => {
    for (const h of Object.values(CONTROL)) expect(h).toBeGreaterThanOrEqual(44);
  });

  it('keeps the web motion budget: nothing over 400ms, press feedback at 100ms', () => {
    expect(Math.max(...Object.values(MOTION.duration))).toBeLessThanOrEqual(400);
    expect(MOTION.duration.fast).toBe(100);
  });

  it('gives every type role a line height above its size', () => {
    for (const role of Object.values(TYPE)) expect(role.lineHeight).toBeGreaterThan(role.fontSize);
  });
});
