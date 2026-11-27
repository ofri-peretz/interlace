/**
 * The theme provider. One object per scheme, built once and memoised: a component reads
 * `useTheme()` and builds its styles with `useThemedStyles`, which re-runs only when the theme
 * object changes (a scheme flip or new overrides), never on an ordinary render.
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { StyleSheet, useColorScheme, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';
import { createTheme, resolveScheme, type SchemePreference, type Theme, type ThemeOverrides } from './theme-model';
import { resolveMoreContrast, type ContrastPreference, type TextSize } from './reading-prefs';
import { useSystemMoreContrast } from './system-contrast';
import type { NativeThemeName } from './tokens.generated';

const ThemeContext = createContext<Theme | null>(null);

export interface InterlaceProviderProps {
  /** A registered palette to start from. @default 'interlace' */
  theme?: NativeThemeName;
  /** `system` follows the device setting and updates live. @default 'system' */
  scheme?: SchemePreference;
  /** The consumer's brand: colour tokens per scheme, the base corner, font families. */
  overrides?: ThemeOverrides;
  /** The reader's text size, on top of the device's own. @default 'default' */
  textSize?: TextSize;
  /** The reader's contrast choice; `system` follows the device. @default 'system' */
  contrast?: ContrastPreference;
  children: ReactNode;
}

export function InterlaceProvider({
  theme,
  scheme = 'system',
  overrides,
  textSize,
  contrast = 'system',
  children,
}: InterlaceProviderProps) {
  const system = useColorScheme();
  const resolved = resolveScheme(scheme, system);
  const systemMore = useSystemMoreContrast();
  const moreContrast = resolveMoreContrast(contrast, systemMore);
  const value = useMemo(
    () => createTheme({ theme, scheme: resolved, overrides, textSize, moreContrast }),
    [theme, resolved, overrides, textSize, moreContrast],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** The current theme. Outside a provider it is the default light theme, so a stray component still paints. */
const FALLBACK = createTheme({ scheme: 'light' });
export function useTheme(): Theme {
  return useContext(ThemeContext) ?? FALLBACK;
}

/**
 * Styles built from the theme, once per theme. Pass a factory defined at module scope (not an
 * inline arrow) so the memo holds; extra `deps` rebuild it when a prop the styles read changes.
 */
type NamedStyles = Record<string, ViewStyle | TextStyle | ImageStyle>;

export function useThemedStyles<T extends NamedStyles>(
  factory: (theme: Theme) => T,
  deps: readonly unknown[] = [],
): T {
  const theme = useTheme();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `deps` is the caller's list
  return useMemo(() => StyleSheet.create(factory(theme)), [theme, factory, ...deps]);
}
