/**
 * A button. One `highlight` or `primary` per screen is the main action; `secondary`, `outline`
 * and `ghost` sit beside it. 44pt minimum height at every size, a busy state that keeps its width,
 * and the platform's own button semantics for screen readers.
 */
import { memo, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { PressableScale } from './pressable-scale';
import { Text } from './text';
import { useTheme } from './theme';
import type { ControlSize } from './scale';
import type { ColorToken } from './tokens.generated';

export type ButtonVariant = 'primary' | 'highlight' | 'secondary' | 'outline' | 'ghost' | 'destructive';

const SURFACE: Record<ButtonVariant, { bg: ColorToken | null; fg: ColorToken; border: ColorToken | null }> = {
  primary: { bg: 'primary', fg: 'primaryForeground', border: null },
  highlight: { bg: 'highlight', fg: 'highlightForeground', border: null },
  secondary: { bg: 'secondary', fg: 'secondaryForeground', border: null },
  outline: { bg: null, fg: 'foreground', border: 'input' },
  ghost: { bg: null, fg: 'primary', border: null },
  destructive: { bg: 'destructive', fg: 'destructiveForeground', border: null },
};

const PADDING: Record<ControlSize, number> = { sm: 14, md: 18, lg: 22 };

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ControlSize;
  /** Shows a spinner and blocks presses, keeping the button's size. */
  busy?: boolean;
  /** Stretch to the container's width. */
  block?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const Button = memo(function Button({
  children,
  variant = 'primary',
  size = 'md',
  busy = false,
  block = false,
  disabled,
  leading,
  trailing,
  style,
  accessibilityState,
  ...rest
}: ButtonProps) {
  const theme = useTheme();
  const s = SURFACE[variant];
  const fg = theme.colors[s.fg];
  const off = Boolean(disabled || busy);
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ ...accessibilityState, disabled: off, busy }}
      disabled={off}
      hitSlop={4}
      style={[
        styles.base,
        {
          minHeight: theme.control[size],
          paddingHorizontal: PADDING[size],
          borderRadius: theme.radius.md,
          backgroundColor: s.bg ? theme.colors[s.bg] : 'transparent',
          borderColor: s.border ? theme.colors[s.border] : 'transparent',
          borderWidth: s.border ? StyleSheet.hairlineWidth * 2 : 0,
          opacity: disabled ? 0.5 : 1,
          alignSelf: block ? 'stretch' : 'flex-start',
        },
        style,
      ]}
      {...rest}
    >
      <View style={[styles.row, busy && styles.hidden]}>
        {leading}
        {typeof children === 'string' ? (
          <Text variant="label" style={{ color: fg }} numberOfLines={2} align="center">
            {children}
          </Text>
        ) : (
          children
        )}
        {trailing}
      </View>
      {busy ? <ActivityIndicator color={fg} style={StyleSheet.absoluteFill} /> : null}
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hidden: { opacity: 0 },
});
