/**
 * A surface. Give it `onPress` and the whole card is one target with press feedback, announced as
 * a button (or a link with `accessibilityRole="link"`); without it, it is a plain container.
 */
import { memo, type ReactNode } from 'react';
import { StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { PressableScale } from './pressable-scale';
import { useTheme } from './theme';
import { SPACE, type Space } from './scale';
import type { ColorToken } from './tokens.generated';

export type CardTone = 'default' | 'muted' | 'primary' | 'highlight';

const TONE: Record<CardTone, { bg: ColorToken; border: ColorToken | null }> = {
  default: { bg: 'card', border: 'border' },
  muted: { bg: 'muted', border: null },
  primary: { bg: 'primarySubtle', border: null },
  highlight: { bg: 'highlight', border: null },
};

export interface CardProps extends Omit<PressableProps, 'style' | 'children'> {
  children: ReactNode;
  tone?: CardTone;
  padding?: Space;
  style?: StyleProp<ViewStyle>;
}

export const Card = memo(function Card({ children, tone = 'default', padding = 'lg', style, onPress, ...rest }: CardProps) {
  const theme = useTheme();
  const t = TONE[tone];
  const surface: ViewStyle = {
    backgroundColor: theme.colors[t.bg],
    borderColor: t.border ? theme.colors[t.border] : 'transparent',
    borderWidth: t.border ? StyleSheet.hairlineWidth : 0,
    borderRadius: theme.radius.lg,
    padding: SPACE[padding],
    gap: SPACE.sm,
  };
  if (!onPress) return <View style={[surface, style]}>{children}</View>;
  return (
    <PressableScale accessibilityRole="button" onPress={onPress} style={[surface, style]} {...rest}>
      {children}
    </PressableScale>
  );
});
