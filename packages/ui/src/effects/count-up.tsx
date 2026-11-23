'use client';

/**
 * @interlace/ui — CountUp
 *
 * A number that counts to its value the first time it scrolls into view:
 * "120 sources", "4.8k readers", "98%". The figure is the content, so the
 * component is built around reading it, not around the motion.
 *
 * ## The number is always there
 *
 * The server renders the final value, so a page without scripts, a crawler
 * and a screen reader all get the real figure. On the client, before the
 * first paint, the visible digits drop to `from` and wait; when the number
 * enters the viewport they count up. Assistive tech reads one stable label
 * (the final value, in an `sr-only` span) and never the moving digits, which
 * are `aria-hidden`.
 *
 * ## No layout shift
 *
 * The final value is laid out invisibly in the same grid cell as the moving
 * one, so the box is as wide as the final figure from the start, and digits
 * use `tabular-nums` so they do not jitter while they change.
 *
 * ## Formatting
 *
 * `format` takes any `Intl.NumberFormatOptions` (decimals, compact notation,
 * percent, currency, units) and `locale` picks the locale. Every frame is
 * formatted with the same formatter, so "4.8k" counts as "1.2k, 2.5k…" and
 * never shows a raw "4812.3".
 *
 * ## Motion
 *
 * Under `prefers-reduced-motion: reduce` the final value shows at once.
 * Colour is inherited, so the number takes the colour of the text around it.
 *
 * | Rule | Concept                 | Where in this file                                   |
 * | ---- | ----------------------- | ---------------------------------------------------- |
 * | R4   | Extends native el       | `span` props                                          |
 * | R6   | data-slot per part      | count-up / -label / -digits                           |
 * | R7   | cn + ...rest            | `cn(…, className)` + `{...props}`                     |
 * | R8   | Enums, not booleans     | `start`                                               |
 * | R19  | Tokens only             | inherits `currentColor`; no colour of its own          |
 * | R25  | Client component        | the count runs in the browser                         |
 * | R26  | A11y                    | one stable label; moving digits hidden                |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';
import { useReducedMotion } from '../lib/use-reduced-motion.js';

export interface CountUpProps extends Omit<React.ComponentPropsWithoutRef<'span'>, 'children'> {
  /** The number to show. */
  value: number;
  /** Where the count starts. @default 0 */
  from?: number;
  /** Length of the count, in milliseconds. @default 1200 */
  duration?: number;
  /** How to write the number: any `Intl.NumberFormat` options. @default {} */
  format?: Intl.NumberFormatOptions;
  /** Locale for the formatter. @default the browser's */
  locale?: string | string[];
  /** Count when the number scrolls into view, or as soon as it mounts. @default 'visible' */
  start?: 'visible' | 'mount';
}

/** Fast at first, settling into the final value. */
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

export function CountUp({
  value,
  from = 0,
  duration = 1200,
  format,
  locale,
  start = 'visible',
  className,
  ...props
}: CountUpProps) {
  const reduced = useReducedMotion();
  const rootRef = React.useRef<HTMLSpanElement>(null);
  const digitsRef = React.useRef<HTMLSpanElement>(null);

  // Keyed by value, so a new options object each render does not restart the count.
  const localeKey = Array.isArray(locale) ? locale.join(',') : (locale ?? '');
  const formatKey = JSON.stringify(format ?? {});
  const formatter = React.useMemo(
    () =>
      new Intl.NumberFormat(
        localeKey ? localeKey.split(',') : undefined,
        JSON.parse(formatKey) as Intl.NumberFormatOptions,
      ),
    [localeKey, formatKey],
  );
  const finalText = formatter.format(value);

  // Before paint: drop the visible digits to the starting value.
  React.useLayoutEffect(() => {
    const digits = digitsRef.current;
    if (!digits || reduced) return;
    digits.textContent = formatter.format(from);
  }, [formatter, from, reduced]);

  React.useEffect(() => {
    const root = rootRef.current;
    const digits = digitsRef.current;
    if (!root || !digits) return;
    if (reduced || duration <= 0) {
      digits.textContent = finalText;
      return;
    }

    let frame = 0;
    let started = 0;
    const tick = (now: number) => {
      if (!started) started = now;
      const t = Math.min((now - started) / duration, 1);
      digits.textContent = formatter.format(from + (value - from) * easeOutCubic(t));
      if (t < 1) frame = requestAnimationFrame(tick);
      else digits.textContent = finalText;
    };
    const run = () => {
      frame = requestAnimationFrame(tick);
    };

    if (start === 'mount' || typeof IntersectionObserver === 'undefined') {
      run();
      return () => cancelAnimationFrame(frame);
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          run();
        }
      },
      { threshold: 0.5 },
    );
    io.observe(root);
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [formatter, finalText, from, value, duration, start, reduced]);

  return (
    <span
      ref={rootRef}
      data-slot="count-up"
      className={cn('inline-grid tabular-nums', className)}
      {...props}
    >
      <span data-slot="count-up-label" className="sr-only">
        {finalText}
      </span>
      <span aria-hidden className="invisible col-start-1 row-start-1">
        {finalText}
      </span>
      <span
        ref={digitsRef}
        aria-hidden
        data-slot="count-up-digits"
        className="col-start-1 row-start-1 text-end"
      >
        {finalText}
      </span>
    </span>
  );
}
