import { describe, expect, it } from 'vitest';
import { auditPalette, contrastRatio, mixHex } from '../src/contrast';
import {
  DEFAULT_READING_PREFS,
  TEXT_SIZES,
  isContrastPreference,
  isTextSize,
  moreContrastPalette,
  parseReadingPrefs,
  resolveMoreContrast,
  serializeReadingPrefs,
  stepTextSize,
  textScaleOf,
  textSizeControlModel,
} from '../src/reading-prefs';
import { TYPE, scaleType } from '../src/scale';
import { createTheme } from '../src/theme-model';
import { THEME_PALETTES, type NativeThemeName, type Palette } from '../src/tokens.generated';

const everyPalette = Object.keys(THEME_PALETTES).flatMap((name) =>
  (['light', 'dark'] as const).map((scheme) => ({
    name,
    scheme,
    palette: THEME_PALETTES[name as NativeThemeName][scheme] as Palette,
  })),
);

describe('text sizes', () => {
  it('are the web kit sizes, smallest first', () => {
    expect(TEXT_SIZES.map((s) => [s.value, s.scale, s.label])).toEqual([
      ['default', 1, '100%'],
      ['lg', 1.125, '112%'],
      ['xl', 1.25, '125%'],
      ['2xl', 1.5, '150%'],
    ]);
  });

  it('knows a registered size from anything else', () => {
    expect(isTextSize('xl')).toBe(true);
    expect(isTextSize('huge')).toBe(false);
    expect(isTextSize(undefined)).toBe(false);
    expect(textScaleOf('2xl')).toBe(1.5);
    expect(textScaleOf('huge')).toBe(1);
    expect(textScaleOf(undefined)).toBe(1);
  });

  it('steps one at a time and holds at both ends', () => {
    expect(stepTextSize('default', 1)).toBe('lg');
    expect(stepTextSize('lg', -1)).toBe('default');
    expect(stepTextSize('default', -1)).toBe('default');
    expect(stepTextSize('2xl', 1)).toBe('2xl');
    expect(stepTextSize('xl', 1)).toBe('2xl');
  });

  it('tells the control its label and which end it is at', () => {
    expect(textSizeControlModel('default')).toEqual({ label: '100%', atMin: true, atMax: false });
    expect(textSizeControlModel('lg')).toEqual({ label: '112%', atMin: false, atMax: false });
    expect(textSizeControlModel('2xl')).toEqual({ label: '150%', atMin: false, atMax: true });
    // A stale value from storage reads as the default, never as an end that is not there.
    expect(textSizeControlModel('gone' as never)).toEqual({ label: '100%', atMin: true, atMax: false });
  });
});

describe('the contrast preference', () => {
  it('follows the device only under system', () => {
    expect(resolveMoreContrast('system', true)).toBe(true);
    expect(resolveMoreContrast('system', false)).toBe(false);
    expect(resolveMoreContrast('more', false)).toBe(true);
    // The reader said no: the device's request no longer overrides them.
    expect(resolveMoreContrast('normal', true)).toBe(false);
  });

  it('knows a registered preference', () => {
    expect(['more', 'normal', 'system'].every(isContrastPreference)).toBe(true);
    expect(isContrastPreference('high')).toBe(false);
  });
});

describe('stored preferences', () => {
  it('round-trip', () => {
    const prefs = { textSize: 'xl', contrast: 'more' } as const;
    expect(parseReadingPrefs(serializeReadingPrefs(prefs))).toEqual(prefs);
  });

  it('read as the default when missing, corrupt or unregistered', () => {
    for (const raw of [undefined, null, '', 'not json', 'null', '{"textSize":"huge","contrast":"x"}'])
      expect(parseReadingPrefs(raw)).toEqual(DEFAULT_READING_PREFS);
  });

  it('keep the half that is valid', () => {
    expect(parseReadingPrefs('{"textSize":"lg","contrast":"x"}')).toEqual({ textSize: 'lg', contrast: 'system' });
    expect(parseReadingPrefs('{"textSize":"?","contrast":"normal"}')).toEqual({ textSize: 'default', contrast: 'normal' });
  });
});

describe('mixHex', () => {
  it('matches CSS color-mix in srgb', () => {
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mixHex('#ff0000', '#0000ff', 0.25)).toBe('#4000bf');
    expect(mixHex('#123456', '#abcdef', 1)).toBe('#123456');
    expect(mixHex('#123456', '#abcdef', 0)).toBe('#abcdef');
    expect(mixHex('#fff', '#000', 0.06)).toBe('#0f0f0f');
  });

  it('refuses a value that is not hex', () => {
    expect(() => mixHex('red', '#000000', 0.5)).toThrow(/mixHex/);
    expect(() => mixHex('#000000', 'blue', 0.5)).toThrow(/mixHex/);
  });
});

describe('the AAA audit', () => {
  const grey: Palette = { ...THEME_PALETTES.interlace.light, foreground: '#767676', cardForeground: '#767676' };

  it('asks 7:1 of text and keeps 3:1 for a control outline', () => {
    const aa = auditPalette(grey);
    const aaa = auditPalette(grey, 'AAA');
    expect(aaa.length).toBeGreaterThan(aa.length);
    expect(aaa.find((f) => f.fg === 'foreground')?.min).toBe(7);
    const outlines = auditPalette(THEME_PALETTES.interlace.light, 'AAA').filter((f) => f.fg === 'input' || f.fg === 'ring');
    expect(outlines.every((f) => f.min === 3)).toBe(true);
  });
});

describe('moreContrastPalette', () => {
  for (const { name, scheme, palette } of everyPalette) {
    it(`reaches AAA on ${name} ${scheme}, and the pressed states keep their text`, () => {
      const more = moreContrastPalette(palette);
      expect(auditPalette(more, 'AAA')).toEqual([]);
      expect(auditPalette(more)).toEqual([]);
      for (const state of ['primary', 'primaryHover', 'primaryActive'] as const)
        expect(contrastRatio(more.primaryForeground, more[state])).toBeGreaterThanOrEqual(7);
      // Text on every tinted surface, not only on the page.
      for (const surface of ['muted', 'accent', 'secondary', 'primarySubtle', 'card'] as const)
        expect(contrastRatio(more.foreground, more[surface])).toBeGreaterThanOrEqual(7);
    });
  }

  const light = THEME_PALETTES.interlace.light as Palette;

  it('makes secondary text the foreground and surfaces a faint tint of it', () => {
    const more = moreContrastPalette(light);
    expect(more.mutedForeground).toBe(light.foreground);
    expect(more.muted).toBe(mixHex(light.foreground, light.background, 0.06));
    expect(more.border).toBe(mixHex(light.foreground, light.background, 0.55));
    expect(more.input).toBe(more.border);
    expect(more.ring).toBe(light.foreground);
    expect(more.primary).toBe(light.foreground);
    expect(more.primaryForeground).toBe(light.background);
  });

  it('pulls every status colour toward the foreground, keeping its hue', () => {
    const more = moreContrastPalette(light);
    for (const k of ['destructive', 'success', 'warning', 'info', 'caution'] as const) {
      expect(more[k]).toBe(mixHex(light[k], light.foreground, 0.45));
      expect(more[k]).not.toBe(light[k]);
      expect(more[`${k}Foreground` as const]).toBe(light.background);
    }
  });

  it('leaves highlight, the scrim and the charts alone', () => {
    const more = moreContrastPalette(light);
    for (const k of ['highlight', 'highlightForeground', 'scrim', 'scrimForeground', 'chart1', 'chart5', 'vizGrid', 'background', 'foreground', 'card'] as const)
      expect(more[k]).toBe(light[k]);
  });

  it("takes the brand's own measured primary pair", () => {
    const more = moreContrastPalette(light, { primary: '#0b2f80', primaryForeground: '#ffffff' });
    expect(more.primary).toBe('#0b2f80');
    expect(more.primaryForeground).toBe('#ffffff');
    expect(auditPalette(more, 'AAA')).toEqual([]);
    expect(contrastRatio(more.primary, light.background)).toBeGreaterThanOrEqual(7);
  });

  it('does not change the palette it was given', () => {
    const copy = { ...light };
    moreContrastPalette(light);
    expect(light).toEqual(copy);
  });
});

describe('scaleType', () => {
  it('grows size, line height and tracking together, rounded to whole points', () => {
    const big = scaleType(TYPE, 1.5);
    expect(big.body.fontSize).toBe(26);
    expect(big.body.lineHeight).toBe(39);
    expect(big.display.letterSpacing).toBe(-0.6);
    expect(big.body.fontWeight).toBe(TYPE.body.fontWeight);
    expect(big.title.font).toBe('display');
    expect(TYPE.body.fontSize).toBe(17);
  });
});

describe('createTheme with reading preferences', () => {
  it('keeps the shared type ramp at the default size', () => {
    const t = createTheme({ scheme: 'light' });
    expect(t.type).toBe(TYPE);
    expect(t.textScale).toBe(1);
    expect(t.moreContrast).toBe(false);
  });

  it('scales every role at a larger size, leaving the touch targets alone', () => {
    const t = createTheme({ scheme: 'light', textSize: 'xl' });
    expect(t.textScale).toBe(1.25);
    expect(t.type.body.fontSize).toBe(21);
    expect(t.type.caption.fontSize).toBe(16);
    expect(t.control.sm).toBe(44);
  });

  it('paints More contrast over the brand: the reader outranks the overrides', () => {
    const brand = { light: { primary: '#2a6df4', mutedForeground: '#9aa0a6' } };
    const normal = createTheme({ scheme: 'light', overrides: brand });
    expect(normal.colors.primary).toBe('#2a6df4');
    const more = createTheme({ scheme: 'light', overrides: brand, moreContrast: true });
    expect(more.moreContrast).toBe(true);
    expect(more.colors.primary).toBe(more.colors.foreground);
    expect(more.colors.mutedForeground).toBe(more.colors.foreground);
    expect(auditPalette(more.colors, 'AAA')).toEqual([]);
  });

  it("uses the brand's measured pair for the scheme being painted", () => {
    const overrides = { moreContrast: { light: { primary: '#0b2f80' }, dark: { primary: '#bcd0ff' } } };
    expect(createTheme({ scheme: 'light', overrides, moreContrast: true }).colors.primary).toBe('#0b2f80');
    expect(createTheme({ scheme: 'dark', overrides, moreContrast: true }).colors.primary).toBe('#bcd0ff');
    expect(createTheme({ scheme: 'light', overrides }).colors.primary).toBe(THEME_PALETTES.interlace.light.primary);
  });
});
