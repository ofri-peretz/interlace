/**
 * The run a player is on, and the last days as a strip of marks. The arithmetic is the web
 * Streak's (`summarizeStreak`, `streakDays`), so both clients agree on the count, rest days and
 * shields included. Each mark is a shape as well as a colour: filled for played, ring for open,
 * dash for rest, a rounded square for a day a shield covered, empty for missed.
 */
import { memo, useMemo } from 'react';
import { View } from 'react-native';
import { streakDays, summarizeStreak, type Protection, type RestRule, type StreakDayState } from '@interlace/ui/games/streak-model';
import type { DayKey } from '@interlace/ui/games/daily';
import { Stack } from '../stack';
import { Text } from '../text';
import { useTheme } from '../theme';

export interface StreakStripLabels {
  /** "12 days" */
  run: (days: number) => string;
  state: Record<StreakDayState, string>;
  /** "1 shield ready" */
  shields: (held: number) => string;
  /** "3 more days earn a shield" */
  nextShield: (days: number) => string;
}

export const DEFAULT_STREAK_LABELS: StreakStripLabels = {
  run: (n) => (n === 1 ? '1 day' : `${n} days`),
  state: { played: 'played', rest: 'rest day', shielded: 'missed, covered by a shield', missed: 'missed', open: 'today, not played yet', future: 'to come' },
  shields: (n) => (n === 1 ? '1 streak shield ready' : `${n} streak shields ready`),
  nextShield: (n) => (n === 1 ? '1 more day earns a streak shield' : `${n} more days earn a streak shield`),
};

export interface StreakStripProps {
  played: readonly DayKey[];
  today: DayKey;
  rest?: RestRule;
  /** Shields a player earns to cover a missed day. */
  protection?: Protection;
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
  protection,
  length = 7,
  locale,
  labels: partial,
}: StreakStripProps) {
  const theme = useTheme();
  const labels = { ...DEFAULT_STREAK_LABELS, ...partial };
  const summary = useMemo(
    () => summarizeStreak(played, today, rest, protection),
    [played, today, rest, protection],
  );
  const days = useMemo(
    () => streakDays(played, today, { length, rest, protection }),
    [played, today, length, rest, protection],
  );
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
          const shielded = d.state === 'shielded';
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
                  borderRadius: shielded ? 8 : DOT / 2,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: filled ? theme.colors.primary : 'transparent',
                  borderWidth: filled || d.state === 'rest' ? 0 : 2,
                  borderColor: d.state === 'open' || shielded ? theme.colors.primary : theme.colors.input,
                  borderStyle: d.state === 'future' ? 'dashed' : 'solid',
                }}
              >
                {shielded ? (
                  <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: theme.colors.primary }} />
                ) : null}
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
      {protection && (summary.shields > 0 || summary.nextShieldIn !== null) ? (
        <Text variant="caption" tone={summary.shields > 0 ? 'primary' : 'muted'}>
          {summary.shields > 0 ? labels.shields(summary.shields) : labels.nextShield(summary.nextShieldIn!)}
        </Text>
      ) : null}
    </Stack>
  );
});
