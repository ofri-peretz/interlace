/**
 * Closer for native: one number question, a slider to guess, and how close the guess was. Scored
 * by the same `scoreGuess` as the web game, so a guess made on a phone and one made in a browser
 * land in the same band with the same points, and a server can check either.
 *
 * The words are the caller's (`labels`), the content is the caller's (`question`, `answer`,
 * `children` for the source shown after), and the feel of a result (a haptic, a sound) is the
 * caller's through `onResult`.
 */
import { memo, useCallback, useMemo, useState, type ReactNode } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import {
  scoreGuess,
  snap,
  type CloserBand,
  type CloserRange,
  type CloserResult,
  type CloserScoreOptions,
} from '@interlace/ui/games/closer-model';
import { Badge, type BadgeTone } from '../badge';
import { Button } from '../button';
import { Card } from '../card';
import { MOTION } from '../scale';
import { Slider } from '../slider';
import { Stack } from '../stack';
import { Text } from '../text';

export interface CloserLabels {
  guess: string;
  lockIn: string;
  answer: string;
  points: (points: number) => string;
  band: Record<CloserBand, string>;
  direction: Record<CloserResult['direction'], string>;
}

export const DEFAULT_CLOSER_LABELS: CloserLabels = {
  guess: 'Your guess',
  lockIn: 'Lock it in',
  answer: 'The answer',
  points: (n) => `${n} points`,
  band: { exact: 'Exact.', close: 'Close.', near: 'Near.', far: 'Far off.' },
  direction: { higher: 'It is higher.', lower: 'It is lower.', exact: 'Right on it.' },
};

const BAND_TONE: Record<CloserBand, BadgeTone> = {
  exact: 'success',
  close: 'success',
  near: 'info',
  far: 'neutral',
};

const ENTER = FadeIn.duration(MOTION.duration.medium).reduceMotion(ReduceMotion.System);

export interface CloserGameProps {
  question: string;
  answer: number;
  range: CloserRange;
  /** Where the thumb starts. @default the middle of the range */
  initialGuess?: number;
  scoreOptions?: CloserScoreOptions;
  formatValue?: (value: number) => string;
  labels?: Partial<CloserLabels>;
  onResult?: (result: CloserResult) => void;
  /** Shown under the result: the source, a line of context, a "next" button. */
  children?: ReactNode;
}

export const CloserGame = memo(function CloserGame({
  question,
  answer,
  range,
  initialGuess,
  scoreOptions,
  formatValue = (v) => v.toLocaleString(),
  labels: partial,
  onResult,
  children,
}: CloserGameProps) {
  const labels = useMemo(() => ({ ...DEFAULT_CLOSER_LABELS, ...partial }), [partial]);
  const start = useMemo(
    () => snap(initialGuess ?? (range.scale === 'log' ? Math.sqrt(range.min * range.max) : (range.min + range.max) / 2), range),
    [initialGuess, range],
  );
  const [guess, setGuess] = useState(start);
  const [result, setResult] = useState<CloserResult | null>(null);

  const lockIn = useCallback(() => {
    const r = scoreGuess(guess, answer, range, scoreOptions);
    setResult(r);
    onResult?.(r);
    AccessibilityInfo.announceForAccessibility(
      `${labels.band[r.band]} ${labels.answer}: ${formatValue(r.answer)}. ${labels.points(r.points)}.`,
    );
  }, [guess, answer, range, scoreOptions, onResult, labels, formatValue]);

  return (
    <Stack gap="lg">
      <Text variant="title">{question}</Text>
      <Stack gap="2xs" align="center">
        <Text variant="caption" tone="muted">
          {labels.guess}
        </Text>
        {/* Android reads the guess as it changes; on iOS the slider itself (adjustable) speaks each
            step, and VoiceOver has no live regions. */}
        <Text variant="numeral" tabular align="center" accessibilityLiveRegion="polite">
          {formatValue(guess)}
        </Text>
      </Stack>
      <Slider
        value={guess}
        range={range}
        onChange={setGuess}
        disabled={result !== null}
        marker={result ? result.answer : undefined}
        formatValue={formatValue}
        accessibilityLabel={labels.guess}
      />
      {result ? (
        <Animated.View entering={ENTER}>
          <Card tone="muted">
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <Badge tone={BAND_TONE[result.band]}>{labels.band[result.band]}</Badge>
              <Text variant="label" tabular>
                {labels.points(result.points)}
              </Text>
            </View>
            <Text variant="caption" tone="muted">
              {labels.answer}
            </Text>
            <Text variant="heading" tabular>
              {formatValue(result.answer)}
            </Text>
            <Text variant="body" tone="muted">
              {labels.direction[result.direction]}
            </Text>
            {children}
          </Card>
        </Animated.View>
      ) : (
        <Button variant="highlight" size="lg" block onPress={lockIn}>
          {labels.lockIn}
        </Button>
      )}
    </Stack>
  );
});
