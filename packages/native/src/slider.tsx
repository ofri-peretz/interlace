/**
 * A value slider driven on the UI thread. The thumb follows the finger at the display's frame rate
 * (Gesture Handler + Reanimated, no JS bridge in the loop); the value is computed with the same
 * `fromPosition` the web game uses, so log ranges and steps behave identically on every platform.
 *
 * Screen readers get an adjustable control: swipe up or down moves one step (or 1% of a log range),
 * and the value is read in the caller's words through `formatValue`.
 *
 * Needs react-native-gesture-handler 3.3 or later, for the `usePanGesture` hook API.
 */
import { memo, useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View, type AccessibilityActionEvent, type LayoutChangeEvent } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { fromPosition, toPosition, type CloserRange } from '@interlace/ui/games/closer-model';
import { useTheme } from './theme';

const THUMB = 28;

export interface SliderProps {
  value: number;
  range: CloserRange;
  onChange: (value: number) => void;
  /** Called once when the finger lifts, with the final value. */
  onCommit?: (value: number) => void;
  disabled?: boolean;
  /** A second mark on the track, such as the answer after a guess. */
  marker?: number;
  formatValue?: (value: number) => string;
  accessibilityLabel: string;
}

export const Slider = memo(function Slider({
  value,
  range,
  onChange,
  onCommit,
  disabled = false,
  marker,
  formatValue = String,
  accessibilityLabel,
}: SliderProps) {
  const theme = useTheme();
  const width = useSharedValue(0);
  const position = useSharedValue(toPosition(value, range));
  const last = useRef(value);

  // A value or range set from outside (a reset, a new round, a narrower range) moves the thumb. A
  // value the finger just produced does not: the thumb is already there, and snapping it back to
  // the step from the JS thread would make it stutter behind the finger.
  const lastRange = useRef(range);
  useEffect(() => {
    const r = lastRange.current;
    // Compared by value, so a range written inline (a new object each render) is not a change.
    const sameRange = r.min === range.min && r.max === range.max && r.step === range.step && r.scale === range.scale;
    if (value === last.current && sameRange) return;
    last.current = value;
    lastRange.current = range;
    position.value = toPosition(value, range);
  }, [value, range, position]);

  const fromTrack = useCallback(
    (p: number, done: boolean) => {
      const next = fromPosition(p, range);
      if (next !== last.current) {
        last.current = next;
        onChange(next);
      }
      if (done) onCommit?.(next);
    },
    [range, onChange, onCommit],
  );

  const pan = usePanGesture({
    enabled: !disabled,
    activeOffsetX: [-4, 4],
    failOffsetY: [-12, 12],
    onActivate: (e) => {
      'worklet';
      if (width.value <= 0) return;
      position.value = Math.min(1, Math.max(0, e.x / width.value));
      scheduleOnRN(fromTrack, position.value, false);
    },
    onUpdate: (e) => {
      'worklet';
      if (width.value <= 0) return;
      position.value = Math.min(1, Math.max(0, e.x / width.value));
      scheduleOnRN(fromTrack, position.value, false);
    },
    onDeactivate: () => {
      'worklet';
      scheduleOnRN(fromTrack, position.value, true);
    },
  });

  // The fill slides in from the left as a transform, so dragging never triggers a layout pass.
  const fill = useAnimatedStyle(() => ({
    transform: [{ translateX: (position.value - 1) * width.value }],
  }));
  const thumb = useAnimatedStyle(() => ({
    transform: [{ translateX: position.value * width.value - THUMB / 2 }],
  }));

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      width.value = e.nativeEvent.layout.width;
    },
    [width],
  );

  const nudge = useCallback(
    (e: AccessibilityActionEvent) => {
      const dir = e.nativeEvent.actionName === 'increment' ? 1 : -1;
      const next =
        range.scale === 'log'
          ? fromPosition(toPosition(value, range) + dir * 0.01, range)
          : fromPosition(toPosition(value + dir * (range.step ?? 1), range), range);
      position.value = toPosition(next, range);
      last.current = next;
      onChange(next);
      onCommit?.(next);
    },
    [value, range, onChange, onCommit, position],
  );

  const markerAt = marker === undefined ? null : toPosition(marker, range);

  return (
    <GestureDetector gesture={pan}>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ text: formatValue(value) }}
        accessibilityState={{ disabled }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={nudge}
        hitSlop={{ top: 12, bottom: 12 }}
        style={styles.hit}
      >
        <View onLayout={onLayout} style={[styles.track, { backgroundColor: theme.colors.muted }]}>
          <View style={styles.clip}>
            <Animated.View style={[styles.fill, { backgroundColor: theme.colors.primary }, fill]} />
          </View>
          {markerAt === null ? null : (
            <View
              style={[
                styles.marker,
                { left: `${markerAt * 100}%`, backgroundColor: theme.colors.highlight },
              ]}
            />
          )}
          <Animated.View
            style={[
              styles.thumb,
              {
                backgroundColor: theme.colors.background,
                borderColor: disabled ? theme.colors.input : theme.colors.primary,
              },
              thumb,
            ]}
          />
        </View>
      </View>
    </GestureDetector>
  );
});

const styles = StyleSheet.create({
  hit: { height: 44, justifyContent: 'center' },
  track: { height: 8, borderRadius: 4, justifyContent: 'center' },
  clip: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, overflow: 'hidden', borderRadius: 4 },
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  marker: { position: 'absolute', width: 4, height: 24, marginLeft: -2, borderRadius: 2 },
  thumb: {
    position: 'absolute',
    left: 0,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    borderWidth: 3,
  },
});
