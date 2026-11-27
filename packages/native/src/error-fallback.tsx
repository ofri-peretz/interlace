/**
 * What a screen shows when it crashes, instead of a red box or a blank one. The same words and the
 * same rules as `ErrorFallback` in `@interlace/ui` (the copy and the report come from the same
 * file), drawn as native views. It reports once on mount, moves screen-reader focus to the title,
 * and takes the `{ error, retry }` Expo Router hands an `ErrorBoundary` export, or `reset`.
 *
 *   export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
 *     return <ErrorFallback error={error} retry={retry} where="route: play" />;
 *   }
 *
 * It needs the theme, so render it under `InterlaceProvider`. It renders neither the message nor
 * the stack: both are in the log, never on the screen.
 */
import { memo, useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { AccessibilityInfo, findNodeHandle, View } from 'react-native';
import {
  isDevelopment,
  referenceOf,
  resolveFallbackLabels,
  type ErrorFallbackLabels,
  type ErrorReport,
} from '@interlace/ui/error-report-model';
import { reportError } from '@interlace/ui/error-report';
import { Button } from './button';
import { Screen } from './screen';
import { Stack } from './stack';
import { Text } from './text';

export interface ErrorFallbackProps {
  /** What the router hands a boundary. */
  error: unknown;
  /** Expo Router calls it `retry`; Next and Remix call it `reset`. Pass either. */
  retry?: () => void;
  reset?: () => void;
  /** Where the screen is, for the report: 'route: play'. Required: a report with no place is noise. */
  where: string;
  /** Leave the broken screen. Omit to hide the second button. */
  onBack?: () => void;
  /** Extra lines the app is sure of: 'Your progress is saved.' Rendered as given. */
  reassurance?: ReactNode;
  /** Show the short reference so a person can quote it. @default true */
  showReference?: boolean;
  /** Called once on mount with the error; defaults to the default log's `reportError`. */
  report?: (error: unknown, where: string) => ErrorReport | void;
  labels?: Partial<ErrorFallbackLabels>;
}

const NOT_REPORTED = Symbol('not reported');

export const ErrorFallback = memo(function ErrorFallback({
  error,
  retry,
  reset,
  where,
  onBack,
  reassurance,
  showReference = true,
  report = reportError,
  labels,
}: ErrorFallbackProps) {
  const onRetry = retry ?? reset;
  const copy = resolveFallbackLabels(labels, { canRetry: onRetry !== undefined, canBack: onBack !== undefined });
  const titleRef = useRef<ComponentRef<typeof View>>(null);
  const reported = useRef<unknown>(NOT_REPORTED);
  const [reference, setReference] = useState<string | null>(null);

  // Report once per error object, not once per render.
  useEffect(() => {
    if (reported.current === error) return;
    reported.current = error;
    const kept = report(error, where);
    setReference(kept ? referenceOf(kept.id) : null);
    // `where` and `report` are read once for this error on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  // Land screen-reader focus on the title, once.
  useEffect(() => {
    const node = findNodeHandle(titleRef.current);
    if (node != null) AccessibilityInfo.setAccessibilityFocus(node);
  }, []);

  useEffect(() => {
    if (onRetry === undefined && isDevelopment()) {
      console.warn('[ErrorFallback] pass `retry` or `reset`, or the screen has no Try again.');
    }
  }, [onRetry]);

  return (
    <Screen scroll>
      <View accessibilityRole="alert" accessibilityLiveRegion="polite">
        <Stack gap="md">
          {/* A view holds the focus: the kit's Text has no ref. It reads as one heading. */}
          <View ref={titleRef} accessible accessibilityRole="header">
            <Text variant="title" accessibilityRole="none">
              {copy.title}
            </Text>
          </View>
          <Text tone="muted">{copy.description}</Text>
          {reassurance}
          {onRetry !== undefined || onBack !== undefined ? (
            <Stack gap="sm">
              {onRetry !== undefined ? (
                <Button block onPress={() => onRetry()}>
                  {copy.retry}
                </Button>
              ) : null}
              {onBack !== undefined ? (
                <Button block variant="ghost" onPress={() => onBack()}>
                  {copy.back}
                </Button>
              ) : null}
            </Stack>
          ) : null}
          {showReference && reference !== null ? (
            <Text variant="caption" tone="muted">
              {copy.referenceLine(reference)}
            </Text>
          ) : null}
        </Stack>
      </View>
    </Screen>
  );
});
