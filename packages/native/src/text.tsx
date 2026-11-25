/**
 * Text in a type role and a tone. Headings announce themselves to screen readers, and every role
 * grows with the reader's text size up to `maxFontScale`.
 */
import { memo } from 'react';
import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import { useTheme } from './theme';
import type { TypeRole } from './scale';
import type { ColorToken } from './tokens.generated';

export type TextTone =
  | 'default'
  | 'muted'
  | 'primary'
  | 'destructive'
  | 'success'
  | 'warning'
  | 'info'
  | 'onPrimary'
  | 'onHighlight';

const TONE: Record<TextTone, ColorToken> = {
  default: 'foreground',
  muted: 'mutedForeground',
  primary: 'primary',
  destructive: 'destructive',
  success: 'success',
  warning: 'warning',
  info: 'info',
  onPrimary: 'primaryForeground',
  onHighlight: 'highlightForeground',
};

const HEADER_ROLES = new Set<TypeRole>(['display', 'heading', 'title']);

export interface TextProps extends RNTextProps {
  variant?: TypeRole;
  tone?: TextTone;
  align?: TextStyle['textAlign'];
  weight?: TextStyle['fontWeight'];
  /** Tabular figures, for numbers that change in place (a score, a timer). */
  tabular?: boolean;
}

export const Text = memo(function Text({
  variant = 'body',
  tone = 'default',
  align,
  weight,
  tabular,
  style,
  accessibilityRole,
  maxFontSizeMultiplier,
  ...rest
}: TextProps) {
  const theme = useTheme();
  const role = theme.type[variant];
  const fontFamily = role.font === 'display' ? theme.fonts.display : theme.fonts.text;
  return (
    <RNText
      accessibilityRole={accessibilityRole ?? (HEADER_ROLES.has(variant) ? 'header' : undefined)}
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? theme.maxFontScale}
      style={[
        {
          color: theme.colors[TONE[tone]],
          fontSize: role.fontSize,
          lineHeight: role.lineHeight,
          fontWeight: weight ?? role.fontWeight,
          letterSpacing: role.letterSpacing,
          fontFamily,
          textAlign: align,
          fontVariant: tabular ? ['tabular-nums'] : undefined,
        },
        style,
      ]}
      {...rest}
    />
  );
});
