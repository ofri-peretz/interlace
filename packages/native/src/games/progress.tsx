/**
 * Progress, natively: a player's level (`LevelMeter`), today's goal (`GoalMeter`) and the moment a
 * round ends (`RoundSummary`). The numbers are the web components' (`levelFor`, `gainXp` from
 * `@interlace/ui/games/progress-model`), so a phone and a page show the same level.
 *
 * Bars fill on the UI thread (Reanimated, transform only, 400ms on the move curve) from where they
 * were before a gain; under Reduce Motion they are drawn at their value. Each bar is a
 * `progressbar` with its value as text, and nothing is said by colour alone.
 */
import { memo, useEffect, type ReactNode } from 'react';
import { I18nManager, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import { gainXp, type LevelCurve } from '@interlace/ui/games/progress-model';
import { Card } from '../card';
import { MOTION } from '../scale';
import { Stack } from '../stack';
import { Text } from '../text';
import { useTheme } from '../theme';

const MOVE = Easing.bezier(0.65, 0, 0.35, 1);
const POP = ZoomIn.duration(MOTION.duration.medium).reduceMotion(ReduceMotion.System);

interface BarProps {
  /** 0 to 1, where the fill starts. */
  from: number;
  /** 0 to 1, where it ends. */
  to: number;
  label: string;
  valueText: string;
  height?: number;
}

const clamp = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

const Bar = memo(function Bar({ from, to, label, valueText, height = 10 }: BarProps) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const width = useSharedValue(0);
  const progress = useSharedValue(reduced ? clamp(to) : clamp(from));

  useEffect(() => {
    progress.value = reduced ? clamp(to) : withTiming(clamp(to), { duration: MOTION.duration.slow, easing: MOVE });
  }, [to, reduced, progress]);

  const dir = I18nManager.isRTL ? -1 : 1;
  const fill = useAnimatedStyle(() => ({
    transform: [{ translateX: dir * (progress.value - 1) * width.value }],
  }));

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamp(to) * 100), text: valueText }}
      onLayout={(e: LayoutChangeEvent) => {
        width.value = e.nativeEvent.layout.width;
      }}
      style={{ height, borderRadius: height / 2, overflow: 'hidden', backgroundColor: theme.colors.muted }}
    >
      <Animated.View
        style={[
          { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, borderRadius: height / 2 },
          { backgroundColor: theme.colors.primary },
          fill,
        ]}
      />
    </View>
  );
});

export interface LevelMeterLabels {
  level: (level: number) => string;
  toNext: (xp: number, nextLevel: number) => string;
  gained: (xp: number) => string;
  bar: string;
  value: (into: number, span: number) => string;
}

export const DEFAULT_LEVEL_LABELS: LevelMeterLabels = {
  level: (n) => `Level ${n}`,
  toNext: (xp, n) => `${xp} XP to level ${n}`,
  gained: (n) => `+${n} XP`,
  bar: 'Progress to the next level',
  value: (into, span) => `${into} of ${span} XP`,
};

export interface LevelMeterProps {
  /** All the player's XP, the latest gain included. */
  xp: number;
  /** XP just earned (included in `xp`): shows the gain and fills the bar from before it. */
  gained?: number;
  curve?: Partial<LevelCurve>;
  labels?: Partial<LevelMeterLabels>;
}

export const LevelMeter = memo(function LevelMeter({ xp, gained = 0, curve, labels: partial }: LevelMeterProps) {
  const theme = useTheme();
  const labels = { ...DEFAULT_LEVEL_LABELS, ...partial };
  const total = Number.isFinite(xp) && xp > 0 ? xp : 0;
  const g = Math.min(total, Number.isFinite(gained) && gained > 0 ? gained : 0);
  const { before, after, levelsUp } = gainXp(total - g, g, curve);
  const from = g === 0 ? after.progress : levelsUp > 0 ? 0 : before.progress;

  return (
    <Stack gap="sm">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          style={{
            width: 32,
            height: 32,
            borderRadius: theme.radius.md,
            backgroundColor: theme.colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text variant="label" tone="onPrimary" tabular>
            {after.level}
          </Text>
        </View>
        <Text variant="label" style={{ flex: 1 }}>
          {labels.level(after.level)}
        </Text>
        {g > 0 ? (
          <Animated.View entering={POP}>
            <Text variant="label" tone="primary" tabular>
              {labels.gained(g)}
            </Text>
          </Animated.View>
        ) : null}
      </View>
      <Bar from={from} to={after.progress} label={labels.bar} valueText={labels.value(after.into, after.span)} />
      <Text variant="caption" tone="muted" tabular>
        {labels.toNext(after.toNext, after.level + 1)}
      </Text>
    </Stack>
  );
});

export interface GoalMeterLabels {
  name: string;
  value: (earned: number, goal: number) => string;
  met: string;
}

export const DEFAULT_GOAL_LABELS: GoalMeterLabels = {
  name: 'Daily goal',
  value: (earned, goal) => `${earned} of ${goal} XP`,
  met: 'Goal met',
};

export interface GoalMeterProps {
  /** Earned today, the latest gain included. */
  earned: number;
  goal: number;
  /** Earned before the latest gain: the bar fills from here. */
  earnedBefore?: number;
  labels?: Partial<GoalMeterLabels>;
}

export const GoalMeter = memo(function GoalMeter({ earned, goal, earnedBefore, labels: partial }: GoalMeterProps) {
  const labels = { ...DEFAULT_GOAL_LABELS, ...partial };
  const e = Number.isFinite(earned) && earned > 0 ? earned : 0;
  const g = Number.isFinite(goal) && goal > 0 ? goal : 0;
  const met = g === 0 || e >= g;
  const to = g === 0 ? 1 : e / g;
  const from = earnedBefore === undefined || g === 0 ? to : earnedBefore / g;
  const valueText = labels.value(e, g);
  return (
    <Stack gap="xs">
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <Text variant="caption" tone="muted">
          {labels.name}
        </Text>
        <Text variant="caption" tone={met ? 'primary' : 'muted'} weight={met ? '700' : '400'} tabular>
          {met ? `✓ ${labels.met}` : valueText}
        </Text>
      </View>
      <Bar from={from} to={to} label={labels.name} valueText={met ? `${valueText}. ${labels.met}` : valueText} height={8} />
    </Stack>
  );
});

export interface RoundSummaryLabels {
  xp: string;
  streak: (days: number) => string;
  streakKept: string;
}

export const DEFAULT_ROUND_SUMMARY_LABELS: RoundSummaryLabels = {
  xp: 'XP earned',
  streak: (n) => (n === 1 ? '1 day streak' : `${n} day streak`),
  streakKept: 'Kept today',
};

export interface RoundSummaryProps {
  title: string;
  description?: string;
  /** XP this round earned. */
  xp?: number;
  /** Today's goal, as GoalMeter takes it. */
  goal?: GoalMeterProps;
  streak?: { current: number; extended?: boolean };
  /** News worth a moment: a milestone, a level. It pops in once and is announced. */
  highlight?: string;
  labels?: Partial<RoundSummaryLabels>;
  /** The next step: share, play again, done. */
  children?: ReactNode;
}

export const RoundSummary = memo(function RoundSummary({
  title,
  description,
  xp,
  goal,
  streak,
  highlight,
  labels: partial,
  children,
}: RoundSummaryProps) {
  const labels = { ...DEFAULT_ROUND_SUMMARY_LABELS, ...partial };
  return (
    <Stack gap="lg">
      <Stack gap="xs">
        <Text variant="display">{title}</Text>
        {description ? (
          <Text variant="lead" tone="muted">
            {description}
          </Text>
        ) : null}
      </Stack>
      {xp !== undefined || streak ? (
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {xp !== undefined ? (
            <Card style={{ flex: 1 }}>
              <Text variant="caption" tone="muted">
                {labels.xp}
              </Text>
              <Animated.View entering={POP}>
                <Text variant="numeral" tone="primary" tabular>
                  +{xp}
                </Text>
              </Animated.View>
            </Card>
          ) : null}
          {streak ? (
            <Card style={{ flex: 1 }}>
              <Text variant="caption" tone="muted">
                {streak.extended ? labels.streakKept : labels.streak(streak.current)}
              </Text>
              <Animated.View entering={streak.extended ? POP : undefined}>
                <Text
                  variant="numeral"
                  tabular
                  accessibilityLabel={labels.streak(streak.current)}
                >
                  {streak.current}
                </Text>
              </Animated.View>
            </Card>
          ) : null}
        </View>
      ) : null}
      {goal ? (
        <Card>
          <GoalMeter {...goal} />
        </Card>
      ) : null}
      {highlight ? (
        <Animated.View entering={POP} accessibilityLiveRegion="polite">
          <Card tone="highlight">
            <Text variant="label" tone="onHighlight">
              {highlight}
            </Text>
          </Card>
        </Animated.View>
      ) : null}
      {children}
    </Stack>
  );
});
