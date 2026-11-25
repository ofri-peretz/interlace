/**
 * The press feedback every tappable surface shares: it sinks a little while held. The scale runs
 * on the UI thread (Reanimated), so it answers the finger at full frame rate even while the JS
 * thread is busy. Under Reduce Motion it dims instead of moving.
 */
import { memo, useCallback } from 'react';
import { Pressable, type GestureResponderEvent, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { MOTION } from './scale';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const EASE = Easing.bezier(...MOTION.easing.enter);

export interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  /** How far the surface sinks. @default 0.97 */
  scaleTo?: number;
}

export const PressableScale = memo(function PressableScale({
  style,
  scaleTo = MOTION.pressScale,
  onPressIn,
  onPressOut,
  disabled,
  ...rest
}: PressableScaleProps) {
  const reduced = useReducedMotion();
  const pressed = useSharedValue(0);
  const animated = useAnimatedStyle(() =>
    reduced
      ? { opacity: 1 - pressed.value * 0.25 }
      : { transform: [{ scale: 1 - pressed.value * (1 - scaleTo) }] },
  );
  const handleIn = useCallback(
    (e: GestureResponderEvent) => {
      pressed.value = withTiming(1, { duration: MOTION.duration.fast, easing: EASE });
      onPressIn?.(e);
    },
    [onPressIn, pressed],
  );
  const handleOut = useCallback(
    (e: GestureResponderEvent) => {
      pressed.value = withTiming(0, { duration: MOTION.duration.base, easing: EASE });
      onPressOut?.(e);
    },
    [onPressOut, pressed],
  );
  return (
    <AnimatedPressable
      disabled={disabled}
      onPressIn={handleIn}
      onPressOut={handleOut}
      style={[style, animated]}
      {...rest}
    />
  );
});
