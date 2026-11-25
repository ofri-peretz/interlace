/**
 * Building a theme: pure, so a test, a server render or a build script gets the same object a
 * component reads.
 *
 * A consumer brands Interlace native the way it brands the web: by overriding tokens, never by
 * editing a component. `overrides.light` and `overrides.dark` take any colour token (the
 * camelCased `--interlace-*` names), `radius` moves every corner, and `fonts` names the families.
 */
import { CONTROL, MAX_FONT_SCALE, MOTION, SPACE, TYPE, radii } from './scale';
import { THEME_PALETTES, type NativeThemeName, type Palette } from './tokens.generated';

export type Scheme = 'light' | 'dark';
export type SchemePreference = Scheme | 'system';

export interface ThemeFonts {
  /** Family for `display`, `heading`, `title` and `numeral`. Undefined is the platform font. */
  display?: string;
  /** Family for body text and controls. Undefined is the platform font. */
  text?: string;
}

export interface ThemeOverrides {
  light?: Partial<Palette>;
  dark?: Partial<Palette>;
  /** Base corner in points. */
  radius?: number;
  fonts?: ThemeFonts;
}

export interface ThemeInput {
  /** A registered palette to start from. @default 'interlace' */
  theme?: NativeThemeName;
  scheme: Scheme;
  overrides?: ThemeOverrides;
}

export interface Theme {
  name: NativeThemeName;
  scheme: Scheme;
  colors: Palette;
  space: typeof SPACE;
  radius: ReturnType<typeof radii>;
  type: typeof TYPE;
  fonts: ThemeFonts;
  motion: typeof MOTION;
  control: typeof CONTROL;
  maxFontScale: number;
}

/** The scheme to paint: an explicit choice wins; `system` follows the device, light when unknown. */
export function resolveScheme(preference: SchemePreference | undefined, system: string | null | undefined): Scheme {
  if (preference === 'light' || preference === 'dark') return preference;
  return system === 'dark' ? 'dark' : 'light';
}

/** True when `name` is a registered palette. */
export function isNativeThemeName(name: unknown): name is NativeThemeName {
  return typeof name === 'string' && Object.prototype.hasOwnProperty.call(THEME_PALETTES, name);
}

/** The theme a component reads. Unknown override keys are ignored, so a typo cannot add a token. */
export function createTheme({ theme = 'interlace', scheme, overrides }: ThemeInput): Theme {
  if (!isNativeThemeName(theme)) throw new RangeError(`Unknown Interlace theme: ${String(theme)}`);
  const base = THEME_PALETTES[theme];
  const colors = { ...base[scheme] } as Palette;
  const patch = overrides?.[scheme] ?? {};
  for (const key of Object.keys(colors) as (keyof Palette)[]) {
    const value = patch[key];
    if (typeof value === 'string') colors[key] = value;
  }
  return {
    name: theme,
    scheme,
    colors,
    space: SPACE,
    radius: radii(overrides?.radius ?? base.radius),
    type: TYPE,
    fonts: { ...overrides?.fonts },
    motion: MOTION,
    control: CONTROL,
    maxFontScale: MAX_FONT_SCALE,
  };
}
