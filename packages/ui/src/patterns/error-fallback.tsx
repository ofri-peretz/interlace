'use client';

/**
 * @interlace/ui — ErrorFallback
 *
 * What a screen shows when it crashes, instead of a blank page or a red box. Plain words, a Try
 * again button, a way out, and a short reference a person can quote. It reports the error once,
 * on mount, through `reportError` (or the `report` you pass), and imports no router: it takes the
 * `{ error, reset }` that Next and Remix hand a boundary, or the `{ error, retry }` that Expo
 * Router hands one.
 *
 * ## Next, `app/error.tsx` (the app's code, not the kit's)
 *
 *   'use client';
 *   // import { ErrorFallback } where the kit puts it in your app
 *   export default function Error({ error, reset }: { error: Error; reset: () => void }) {
 *     return <ErrorFallback error={error} reset={reset} where="route" onBack={() => history.back()} />;
 *   }
 *
 * ## Expo Router, `export function ErrorBoundary` (the app's code; the native component)
 *
 *   import { ErrorFallback } from '@interlace/native';
 *   export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
 *     return <ErrorFallback error={error} retry={retry} where="route: play" />;
 *   }
 *
 * ## A crash service, ten lines (the app's code): the reporter is the only seam
 *
 *   import { setReporter } from '@interlace/ui/error-report';
 *   setReporter((report) => {
 *     crashService.capture({ place: report.where, message: report.message, stack: report.stack,
 *       fatal: report.fatal, times: report.count });
 *   });
 *   // `report` was redacted and trimmed before it got here. Hand the service nothing else.
 *
 * ## What a report holds, and what it never holds
 *
 * | Holds                                              | Never holds                         |
 * | -------------------------------------------------- | ----------------------------------- |
 * | `where`, which the developer named                 | props, state, storage contents      |
 * | `message`, redacted then trimmed to 300 characters | the URL's query or hash             |
 * | `stack`, redacted then trimmed to 12 lines         | a name, an email, any device id     |
 * | a time, a count, a random id, `fatal`              |                                     |
 *
 * The fallback itself renders neither the message nor the stack: a person does not need a stack,
 * and a stack can hold what they typed. Both are in the log.
 *
 * ## Anatomy
 *
 *   ErrorFallback             (section — data-slot="error-fallback", role="alert", @container)
 *     ├─ title                (h2, tabIndex -1, takes focus on mount)
 *     ├─ description          (p)
 *     ├─ reassurance          (optional node: 'Your progress is saved.' only if the app is sure)
 *     ├─ actions              (Try again, primary; Go back, ghost, when `onBack` is given)
 *     └─ reference            (p, muted: 'Reference: ab12', when `showReference`)
 *
 * ## States
 *
 * | State                              | What it shows                                              |
 * | ---------------------------------- | ---------------------------------------------------------- |
 * | First render                       | Title, description, actions; `report` runs once in an effect |
 * | Retry pressed                      | `reset` or `retry` runs; the router replaces the fallback  |
 * | Neither `reset` nor `retry`        | No Try again, a description that does not promise one, a dev warning |
 * | No `onBack`                        | One button                                                 |
 * | Same `error` re-rendered           | Not reported again                                         |
 * | A new `error`                      | A new report                                               |
 *
 * ## Accessibility
 *
 * On mount focus moves to the title, once, so a keyboard or screen-reader user lands on it instead
 * of on nothing; `role="alert"` reads title and description once. The two actions are named by
 * their visible text (WCAG 2.5.3) and take the Button's 44 px touch target. No motion.
 *
 * ## MIN_VIEWPORT — 320
 *
 * The buttons stack at full width below 20rem of the fallback's own width (`@container`), and sit
 * side by side from it. Logical properties only, so the order follows reading order in RTL.
 *
 * | Rule | Concept                  | Where in this file                                          |
 * | ---- | ------------------------ | ----------------------------------------------------------- |
 * | R4   | Extends native el        | `React.ComponentProps<'section'>`                           |
 * | R6   | data-slot per part       | error-fallback, error-fallback-title, -description, -actions, -reference |
 * | R7   | className merged + rest  | `cn(…, className)` + `{...props}`                           |
 * | R8   | No `isXxx`               | `showReference` is a behaviour switch, not a variant        |
 * | R10  | Composition seam         | `report` (a function, never a vendor prop), `reassurance`   |
 * | R14  | Declares min viewport    | `data-min-viewport` + exported const                        |
 * | R19  | Tokens only              | Typography tones; Button variants                           |
 * | R25  | Client component         | One effect: report once, move focus once                    |
 * | R26  | A11y                     | `role="alert"`, focus to the title, named actions           |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import {
  isDevelopment,
  referenceOf,
  resolveFallbackLabels,
  type ErrorFallbackLabels,
  type ErrorReport,
} from '../lib/error-report-model.js';
import { reportError } from '../lib/error-report.js';
import { Button } from '../primitives/button.js';
import { Typography } from '../primitives/typography.js';

export const MIN_VIEWPORT = 320 as const;

interface ErrorFallbackProps extends Omit<React.ComponentProps<'section'>, 'children'> {
  /** What the router hands a boundary. */
  error: unknown;
  /** Next and Remix call it `reset`; Expo Router calls it `retry`. Pass either. */
  reset?: () => void;
  retry?: () => void;
  /** Where the screen is, for the report: 'route: /play'. Required: a report with no place is noise. */
  where: string;
  /** Leave the broken screen. Omit to hide the second button. */
  onBack?: () => void;
  /** Extra lines the app is sure of: 'Your progress is saved.' Rendered as given. */
  reassurance?: React.ReactNode;
  /** Show the short reference so a person can quote it. @default true */
  showReference?: boolean;
  /** Called once on mount with the error; defaults to the default log's `reportError`. */
  report?: (error: unknown, where: string) => ErrorReport | void;
  labels?: Partial<ErrorFallbackLabels>;
}

const NOT_REPORTED = Symbol('not reported');

function ErrorFallback({
  error,
  reset,
  retry,
  where,
  onBack,
  reassurance,
  showReference = true,
  report = reportError,
  labels,
  className,
  ...props
}: ErrorFallbackProps) {
  const onRetry = reset ?? retry;
  const copy = resolveFallbackLabels(labels, {
    canRetry: onRetry !== undefined,
    canBack: onBack !== undefined,
  });
  const titleRef = React.useRef<HTMLParagraphElement>(null);
  const reported = React.useRef<unknown>(NOT_REPORTED);
  const [reference, setReference] = React.useState<string | null>(null);

  // Report once per error object, not once per render (and not twice under StrictMode).
  React.useEffect(() => {
    if (reported.current === error) return;
    reported.current = error;
    const kept = report(error, where);
    setReference(kept ? referenceOf(kept.id) : null);
    // `where` and `report` are read once for this error on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  // Land on the title, once.
  React.useEffect(() => {
    titleRef.current?.focus();
  }, []);

  React.useEffect(() => {
    if (onRetry === undefined && isDevelopment()) {
      console.warn('[ErrorFallback] pass `reset` or `retry`, or the screen has no Try again.');
    }
  }, [onRetry]);

  return (
    <section
      data-slot="error-fallback"
      data-min-viewport={String(MIN_VIEWPORT)}
      role="alert"
      className={cn('@container flex flex-col gap-4 p-6', className)}
      {...props}
    >
      <Typography
        as="h2"
        variant="h3"
        ref={titleRef}
        tabIndex={-1}
        data-slot="error-fallback-title"
      >
        {copy.title}
      </Typography>
      <Typography variant="body" tone="muted" data-slot="error-fallback-description">
        {copy.description}
      </Typography>
      {reassurance}
      {onRetry !== undefined || onBack !== undefined ? (
        <div
          data-slot="error-fallback-actions"
          className="flex flex-col gap-3 @xs:flex-row @xs:flex-wrap"
        >
          {onRetry !== undefined ? (
            <Button variant="default" onClick={() => onRetry()} className="w-full @xs:w-auto">
              {copy.retry}
            </Button>
          ) : null}
          {onBack !== undefined ? (
            <Button variant="ghost" onClick={() => onBack()} className="w-full @xs:w-auto">
              {copy.back}
            </Button>
          ) : null}
        </div>
      ) : null}
      {showReference && reference !== null ? (
        <Typography as="p" variant="caption" tone="muted" data-slot="error-fallback-reference">
          {copy.referenceLine(reference)}
        </Typography>
      ) : null}
    </section>
  );
}
ErrorFallback.displayName = 'ErrorFallback';

export { ErrorFallback };
export type { ErrorFallbackProps };
