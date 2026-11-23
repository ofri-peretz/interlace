'use client';

/**
 * @interlace/ui — ReadingSettings
 *
 * A text size control and a More contrast toggle: two small controls for the reader, not the theme author. They write the
 * `data-text-size` and `data-contrast` attributes on `<html>` through
 * `useReadingPrefs`, remember the choice, and `THEME_SCRIPT` puts it back
 * before first paint on the next visit.
 *
 * ─── TextSizeControl ─────────────────────────────────────────────
 *
 * Three buttons in a labelled group: smaller, the current size (which resets
 * to 100%), larger. The middle button shows the size as a number, because
 * "A" alone tells a reader nothing about where they are on the scale.
 *
 * At the ends the outer buttons are `aria-disabled`, not `disabled`. A
 * keyboard user pressing "Larger" until it stops would otherwise have focus
 * thrown to `<body>` on the last press, and land at the top of the page.
 *
 * ─── ContrastToggle ──────────────────────────────────────────────
 *
 * A pressed/unpressed button for More contrast. Pressed shows what is on
 * screen, from either the reader's choice or `prefers-contrast: more`.
 * Pressing it stores an explicit choice, so turning it off while the OS asks
 * for more contrast stores `'normal'`: the reader said no, and the page
 * should stop overriding them.
 *
 * Both take their words as props (`label`, `labels`), so a consumer can
 * translate them. Neither carries a colour of its own.
 */

import * as React from 'react';
import { ContrastIcon } from 'lucide-react';

import { cn } from '../lib/cn.js';
import { useReadingPrefs } from '../lib/use-reading-prefs.js';
import { Toggle } from './toggle.js';

const STEP = cn(
  'inline-flex h-control-sm min-w-control-sm items-center justify-center rounded-md px-2 text-ui-sm font-medium',
  'text-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
  'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none',
  'aria-disabled:pointer-events-none aria-disabled:opacity-40',
);

interface TextSizeLabels {
  /** Name of the step-down button. Default: `'Smaller text'`. */
  smaller?: string;
  /** Name of the reset button, before the current size. Default: `'Reset text size'`. */
  reset?: string;
  /** Name of the step-up button. Default: `'Larger text'`. */
  larger?: string;
}

interface TextSizeControlProps extends Omit<React.ComponentProps<'div'>, 'children'> {
  /** The group's accessible name. Default: `'Text size'`. */
  label?: string;
  /** The three buttons' names, for translation. */
  labels?: TextSizeLabels;
}

function TextSizeControl({
  className,
  label = 'Text size',
  labels,
  ...props
}: TextSizeControlProps) {
  const { textSize, textSizes, setTextSize, stepTextSize, mounted } = useReadingPrefs();
  const index = textSizes.findIndex((size) => size.value === textSize);
  const current = textSizes[index] ?? textSizes[0];
  const atMin = index <= 0;
  const atMax = index >= textSizes.length - 1;
  const names = {
    smaller: labels?.smaller ?? 'Smaller text',
    reset: labels?.reset ?? 'Reset text size',
    larger: labels?.larger ?? 'Larger text',
  };

  return (
    <div
      role="group"
      aria-label={label}
      data-slot="text-size-control"
      data-text-size-value={textSize}
      className={cn(
        'inline-flex w-fit items-center gap-0.5 rounded-lg border border-input bg-background p-0.5',
        className,
      )}
      {...props}
    >
      <button
        type="button"
        data-slot="text-size-smaller"
        aria-label={names.smaller}
        aria-disabled={atMin || undefined}
        onClick={() => !atMin && stepTextSize(-1)}
        className={STEP}
      >
        <span aria-hidden="true" className="text-[0.75em]">
          A
        </span>
        <span aria-hidden="true">−</span>
      </button>
      <button
        type="button"
        data-slot="text-size-reset"
        // The visible number is inside the name (WCAG 2.5.3, label in name).
        aria-label={`${names.reset}, ${current.label}`}
        onClick={() => setTextSize('default')}
        className={cn(STEP, 'min-w-14 tabular-nums')}
      >
        {/* Before the storage read the hook reports the default; showing
            "100%" for a reader at 125% would be wrong, so hold the width. */}
        <span className={cn(!mounted && 'invisible')}>{current.label}</span>
      </button>
      <button
        type="button"
        data-slot="text-size-larger"
        aria-label={names.larger}
        aria-disabled={atMax || undefined}
        onClick={() => !atMax && stepTextSize(1)}
        className={STEP}
      >
        <span aria-hidden="true" className="text-[1.15em]">
          A
        </span>
        <span aria-hidden="true">+</span>
      </button>
    </div>
  );
}

interface ContrastToggleProps
  extends Omit<
    React.ComponentProps<typeof Toggle>,
    'pressed' | 'defaultPressed' | 'onPressedChange' | 'value' | 'children'
  > {
  /** Accessible name and visible text. Default: `'More contrast'`. */
  label?: string;
  /** Show the label beside the icon. Default: `true`. */
  showLabel?: boolean;
}

function ContrastToggle({
  className,
  label = 'More contrast',
  showLabel = true,
  ...props
}: ContrastToggleProps) {
  const { moreContrast, setContrast, mounted } = useReadingPrefs();

  return (
    <Toggle
      data-slot="contrast-toggle"
      variant="outline"
      size="sm"
      aria-label={showLabel ? undefined : label}
      pressed={moreContrast}
      onPressedChange={(pressed: boolean) => setContrast(pressed ? 'more' : 'normal')}
      // Until storage is read the hook reports "off", so a reader who chose
      // More contrast would see the toggle flip on. Hold it invisible (its
      // space kept) for that first frame, as TextSizeControl does its label.
      className={cn(!mounted && 'invisible', className)}
      {...props}
    >
      <ContrastIcon aria-hidden="true" className="size-4" />
      {showLabel ? <span>{label}</span> : null}
    </Toggle>
  );
}

export { ContrastToggle, TextSizeControl };
export type { ContrastToggleProps, TextSizeControlProps, TextSizeLabels };
