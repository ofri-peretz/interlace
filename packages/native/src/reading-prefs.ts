/**
 * The reader's two comfort settings, as pure functions: a text size and More contrast. They mirror
 * the web kit (`useReadingPrefs`, `data-text-size`, `data-contrast`) with the same sizes, the same
 * three-way contrast preference and the same AAA rules, in the units a phone paints.
 *
 * Nothing here reads a device or a disk. The consumer stores the choice (see `serializeReadingPrefs`),
 * hands it to `InterlaceProvider`, and the provider reads the device's own contrast setting.
 *
 * Text size multiplies every type role on top of the device's own text size (Dynamic Type, Android
 * font scale), so a reader who already raised it at the system level keeps that and gets this too.
 * The cap on that growth is `MAX_FONT_SCALE`, which this does not lift.
 */
import { mixHex } from './contrast';
import type { Palette } from './tokens.generated';

/** The registered sizes, smallest first. Same values and labels as the web kit. */
export const TEXT_SIZES = [
  { value: 'default', scale: 1, label: '100%' },
  { value: 'lg', scale: 1.125, label: '112%' },
  { value: 'xl', scale: 1.25, label: '125%' },
  { value: '2xl', scale: 1.5, label: '150%' },
] as const;

export type TextSize = (typeof TEXT_SIZES)[number]['value'];

/** `'system'` follows the device's own contrast setting; the others override it. */
export type ContrastPreference = 'more' | 'normal' | 'system';

export const isTextSize = (value: unknown): value is TextSize =>
  TEXT_SIZES.some((size) => size.value === value);

export const isContrastPreference = (value: unknown): value is ContrastPreference =>
  value === 'more' || value === 'normal' || value === 'system';

/** The multiplier for a size. An unregistered value reads as 1. */
export function textScaleOf(size: unknown): number {
  return TEXT_SIZES.find((s) => s.value === size)?.scale ?? 1;
}

/** One step smaller (`-1`) or larger (`1`), held at the ends. */
export function stepTextSize(current: TextSize, direction: -1 | 1): TextSize {
  const index = TEXT_SIZES.findIndex((s) => s.value === current);
  const next = Math.min(TEXT_SIZES.length - 1, Math.max(0, index + direction));
  return TEXT_SIZES[next].value;
}

/** What the text size control shows for a size: its label and whether each end is reached. */
export function textSizeControlModel(current: TextSize) {
  const index = Math.max(
    0,
    TEXT_SIZES.findIndex((s) => s.value === current),
  );
  return {
    label: TEXT_SIZES[index].label,
    atMin: index === 0,
    atMax: index === TEXT_SIZES.length - 1,
  };
}

/** Whether more contrast is on screen: the reader's choice, or the device's when it is `system`. */
export function resolveMoreContrast(preference: ContrastPreference, systemMore: boolean): boolean {
  return preference === 'more' || (preference === 'system' && systemMore);
}

export interface ReadingPrefs {
  textSize: TextSize;
  contrast: ContrastPreference;
}

export const DEFAULT_READING_PREFS: ReadingPrefs = { textSize: 'default', contrast: 'system' };

/** A string for the consumer's own storage. */
export const serializeReadingPrefs = (prefs: ReadingPrefs): string => JSON.stringify(prefs);

/** Reads what `serializeReadingPrefs` wrote. Anything missing, corrupt or unregistered is the default. */
export function parseReadingPrefs(raw: string | null | undefined): ReadingPrefs {
  if (!raw) return DEFAULT_READING_PREFS;
  try {
    const v = JSON.parse(raw) as Partial<Record<keyof ReadingPrefs, unknown>> | null;
    return {
      textSize: isTextSize(v?.textSize) ? v.textSize : DEFAULT_READING_PREFS.textSize,
      contrast: isContrastPreference(v?.contrast) ? v.contrast : DEFAULT_READING_PREFS.contrast,
    };
  } catch {
    return DEFAULT_READING_PREFS;
  }
}

/** The brand's own primary pair in More contrast: it must be measured at 7:1 by the brand. */
export interface MoreContrastBrand {
  primary?: string;
  primaryForeground?: string;
}

/**
 * The palette of More contrast, an AAA reading mode on top of any theme. The same rules as the
 * web's `[data-contrast='more']`, computed in sRGB:
 *
 *   1. Every text colour becomes the foreground. Secondary text stops being grey.
 *   2. Muted, accent, secondary and the subtle primary become a 6% tint of the foreground.
 *   3. Primary becomes foreground on background, unless the brand supplies a measured pair.
 *   4. Status colours mix 45% of themselves into the foreground, with background text on them.
 *   5. Borders and inputs darken to 55% foreground; the ring is the foreground.
 *
 * Highlight, the scrim and the chart colours are left as they are.
 */
export function moreContrastPalette(palette: Palette, brand: MoreContrastBrand = {}): Palette {
  const { foreground, background } = palette;
  const tint = mixHex(foreground, background, 0.06);
  const line = mixHex(foreground, background, 0.55);
  const primary = brand.primary ?? foreground;
  const onPrimary = brand.primaryForeground ?? background;
  const status = (own: string) => mixHex(own, foreground, 0.45);
  return {
    ...palette,
    cardForeground: foreground,
    popoverForeground: foreground,
    muted: tint,
    mutedForeground: foreground,
    accent: tint,
    accentForeground: foreground,
    secondary: tint,
    secondaryForeground: foreground,
    primary,
    // Pressed states move toward the foreground, away from the text on them, so they never lose
    // contrast. With the default primary (the foreground itself) they are the same colour.
    primaryHover: mixHex(primary, foreground, 0.85),
    primaryActive: mixHex(primary, foreground, 0.7),
    primaryForeground: onPrimary,
    primarySubtle: tint,
    primarySubtleForeground: foreground,
    border: line,
    input: line,
    ring: foreground,
    destructive: status(palette.destructive),
    destructiveForeground: background,
    success: status(palette.success),
    successForeground: background,
    warning: status(palette.warning),
    warningForeground: background,
    info: status(palette.info),
    infoForeground: background,
    caution: status(palette.caution),
    cautionForeground: background,
  };
}
