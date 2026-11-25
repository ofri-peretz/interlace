/** A short status in a pill: "Checked", "3 facts", "Day 12". Text, not colour alone, carries the meaning. */
import { memo } from 'react';
import { View } from 'react-native';
import { Text } from './text';
import { useTheme } from './theme';
import type { ColorToken } from './tokens.generated';

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'info' | 'destructive';

const TONE: Record<BadgeTone, { bg: ColorToken; fg: ColorToken }> = {
  neutral: { bg: 'muted', fg: 'mutedForeground' },
  primary: { bg: 'primarySubtle', fg: 'primarySubtleForeground' },
  success: { bg: 'success', fg: 'successForeground' },
  warning: { bg: 'warning', fg: 'warningForeground' },
  info: { bg: 'info', fg: 'infoForeground' },
  destructive: { bg: 'destructive', fg: 'destructiveForeground' },
};

export interface BadgeProps {
  children: string;
  tone?: BadgeTone;
}

export const Badge = memo(function Badge({ children, tone = 'neutral' }: BadgeProps) {
  const theme = useTheme();
  const t = TONE[tone];
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: theme.colors[t.bg],
        borderRadius: theme.radius.full,
        paddingHorizontal: theme.space.sm,
        paddingVertical: theme.space['3xs'],
      }}
    >
      <Text variant="caption" weight="600" style={{ color: theme.colors[t.fg] }}>
        {children}
      </Text>
    </View>
  );
});
