/**
 * Something held back until the reader asks for it: an answer after a guess, the reply after the
 * claim. The hidden part fades in from just below (transform and opacity only, 250ms, nothing
 * under Reduce Motion), and screen readers hear it arrive.
 */
import { memo, useCallback, useState, type ReactNode } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { Button, type ButtonVariant } from './button';
import { MOTION } from './scale';

const ENTER = FadeInDown.duration(MOTION.duration.medium).withInitialValues({ transform: [{ translateY: 8 }] }).reduceMotion(ReduceMotion.System);

export interface RevealProps {
  /** What the reader sees before revealing: the question, the claim. */
  children?: ReactNode;
  /** What appears on reveal. */
  hidden: ReactNode;
  /** The reveal button's words. @default 'Show' */
  label?: string;
  variant?: ButtonVariant;
  /** Controlled: whether the hidden part is shown. */
  revealed?: boolean;
  onReveal?: () => void;
  /** Read aloud by screen readers when the hidden part appears. */
  announce?: string;
}

export const Reveal = memo(function Reveal({
  children,
  hidden,
  label = 'Show',
  variant = 'highlight',
  revealed,
  onReveal,
  announce,
}: RevealProps) {
  const [own, setOwn] = useState(false);
  const open = revealed ?? own;
  const reveal = useCallback(() => {
    setOwn(true);
    onReveal?.();
    if (announce) AccessibilityInfo.announceForAccessibility(announce);
  }, [onReveal, announce]);
  return (
    <View style={{ gap: 16 }}>
      {children}
      {open ? (
        <Animated.View entering={ENTER} accessibilityLiveRegion="polite" style={{ gap: 12 }}>
          {hidden}
        </Animated.View>
      ) : (
        <Button variant={variant} block onPress={reveal}>
          {label}
        </Button>
      )}
    </View>
  );
});
