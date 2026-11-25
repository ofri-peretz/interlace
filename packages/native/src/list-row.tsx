/**
 * One row of a list: a title, an optional line under it, and slots either side. Memoised and
 * fixed in structure so a FlashList can recycle it without re-laying it out.
 */
import { memo, type ReactNode } from 'react';
import { StyleSheet, View, type PressableProps } from 'react-native';
import { PressableScale } from './pressable-scale';
import { Text } from './text';
import { useTheme } from './theme';

export interface ListRowProps extends Omit<PressableProps, 'children' | 'style'> {
  title: string;
  subtitle?: string;
  /** A short line above the title: a chapter, a category. */
  overline?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  /** Lines the title may take before it is cut. @default 3 */
  titleLines?: number;
}

export const ListRow = memo(function ListRow({
  title,
  subtitle,
  overline,
  leading,
  trailing,
  titleLines = 3,
  onPress,
  ...rest
}: ListRowProps) {
  const theme = useTheme();
  const body = (
    <>
      {leading}
      <View style={styles.text}>
        {overline ? (
          <Text variant="caption" tone="primary" numberOfLines={1}>
            {overline}
          </Text>
        ) : null}
        <Text variant="label" numberOfLines={titleLines}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" tone="muted" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
    </>
  );
  const row = [
    styles.row,
    {
      minHeight: theme.control.md + 8,
      paddingHorizontal: theme.space.lg,
      paddingVertical: theme.space.md,
      gap: theme.space.md,
      borderBottomColor: theme.colors.border,
    },
  ];
  if (!onPress) return <View style={row}>{body}</View>;
  return (
    <PressableScale accessibilityRole="button" onPress={onPress} scaleTo={0.99} style={row} {...rest}>
      {body}
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  text: { flex: 1, gap: 2 },
});
