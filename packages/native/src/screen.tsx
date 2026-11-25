/**
 * A screen's background and safe area. `scroll` gives a ScrollView that keeps its content clear
 * of the notch and the home indicator; without it, a plain view for screens that hold a list
 * (a FlashList scrolls itself and should not sit inside a ScrollView).
 */
import { memo, type ReactNode } from 'react';
import { ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';
import { useTheme } from './theme';
import { SPACE, type Space } from './scale';

export interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  /** Edges that get the safe-area inset. A screen under a native header or tab bar drops `top` or `bottom`. */
  edges?: readonly Edge[];
  padding?: Space;
  tone?: 'background' | 'muted';
  contentStyle?: StyleProp<ViewStyle>;
}

export const Screen = memo(function Screen({
  children,
  scroll = false,
  edges = ['top', 'bottom', 'left', 'right'],
  padding = 'lg',
  tone = 'background',
  contentStyle,
}: ScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const pad = SPACE[padding];
  const inset: ViewStyle = {
    paddingTop: (edges.includes('top') ? insets.top : 0) + pad,
    paddingBottom: (edges.includes('bottom') ? insets.bottom : 0) + pad,
    paddingLeft: (edges.includes('left') ? insets.left : 0) + pad,
    paddingRight: (edges.includes('right') ? insets.right : 0) + pad,
    gap: SPACE.lg,
  };
  const bg = { flex: 1, backgroundColor: theme.colors[tone] };
  if (!scroll) return <View style={[bg, inset, contentStyle]}>{children}</View>;
  return (
    <ScrollView
      style={bg}
      contentContainerStyle={[inset, contentStyle]}
      contentInsetAdjustmentBehavior="never"
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
});
