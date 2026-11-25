/**
 * The run a player is on, and the last days as a strip of marks. The arithmetic is the web
 * Streak's (`summarizeStreak`, `streakDays`), so both clients agree on the count, rest days
 * included. Each mark is a shape as well as a colour: filled for played, ring for open, dash for
 * rest, empty for missed.
 */
import { memo, useMemo } from 'react';
import { View } from 'react-native';
import { streakDays, summarizeStreak, type RestRule, type StreakDayState } from '@interlace/ui/games/streak-model';
import type { DayKey } from '@interlace/ui/games/daily';
import { Stack } from '../stack';
import { Text } from '../text';
import { useTheme } from '../theme';

export interface StreakStripLabels {
  /** "12 days" */
  run: (days: number) => string;
  state: Record<StreakDayState, string>;
}

export const DEFAULT_STREAK_LABELS: StreakStripLabels = {
  run: (n) => (n === 1 ? '1 day' : `${n} days`),
  state: { played: 'played', rest: 'rest day', missed: 'missed', open: 'today, not played yet', future: 'to come' },
};

export interface StreakStripProps {
  played: readonly DayKey[];
  today: DayKey;
  rest?: RestRule;
  /** Days shown, ending today. @default 7 */
  length?: number;
  /** BCP 47 locale for the weekday letters. */
  locale?: string;
  labels?: Partial<StreakStripLabels>;
}

const DOT = 28;

export const StreakStrip = memo(function StreakStrip({
  played,
  today,
  rest,
  length = 7,
  locale,
  labels: partial,
}: StreakStripProps) {
  const theme = useTheme();
  const labels = { ...DEFAULT_STREAK_LABELS, ...partial };
  const summary = useMemo(() => summarizeStreak(played, today, rest), [played, today, rest]);
  const days = useMemo(() => streakDays(played, today, { length, rest }), [played, today, length, rest]);
  const weekday = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: 'narrow', timeZone: 'UTC' }), [locale]);
  const long = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }), [locale]);

  return (
    <Stack gap="sm">
      <Text variant="title" tabular>
        {labels.run(summary.current)}
      </Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {days.map((d) => {
          const date = new Date(`${d.day}T12:00:00Z`);
          const filled = d.state === 'played';
          return (
            <View
              key={d.day}
              accessible
              accessibilityLabel={`${long.format(date)}: ${labels.state[d.state]}`}
              style={{ alignItems: 'center', gap: 4 }}
            >
              <View
                style={{
                  width: DOT,
                  height: DOT,
                  borderRadius: DOT / 2,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: filled ? theme.colors.primary : 'transparent',
                  borderWidth: filled || d.state === 'rest' ? 0 : 2,
                  borderColor: d.state === 'open' ? theme.colors.primary : theme.colors.input,
                  borderStyle: d.state === 'future' ? 'dashed' : 'solid',
                }}
              >
                {d.state === 'rest' ? (
                  <View style={{ width: 12, height: 3, borderRadius: 2, backgroundColor: theme.colors.mutedForeground }} />
                ) : null}
              </View>
              <Text variant="caption" tone={d.today ? 'default' : 'muted'} weight={d.today ? '700' : '400'}>
                {weekday.format(date)}
              </Text>
            </View>
          );
        })}
      </View>
    </Stack>
  );
});
