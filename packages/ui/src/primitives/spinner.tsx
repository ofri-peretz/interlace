/**
 * @interlace/ui — Spinner
 *
 * Something is working and there is no number to show yet. The shadcn core
 * `spinner` item, drawn in Interlace tokens. Use `Progress` when you know how
 * far along it is, and `Skeleton` when you know the shape of what is coming.
 *
 * Server component — an inline SVG, nothing to hydrate.
 *
 * ## Anatomy
 *
 *   Spinner                          (svg role=status — data-min-viewport=320)
 *     ├─ circle                      (the track, faint)
 *     └─ path                        (the arc that turns)
 *
 * ## Announced, once
 *
 * `role="status"` is a polite live region: a screen reader announces the
 * `label` ("Loading" by default) when the spinner is inserted after the page
 * has loaded, as in `{isLoading && <Spinner />}` driven by client state. A
 * spinner already in the server HTML is not announced; it is read in order
 * like any other text. Pass `label` in the page's language. When the spinner
 * sits next to text that already says what is happening ("Saving your
 * changes"), or inside a button with `aria-busy`, pass `decorative` so it is
 * hidden and nothing is read twice.
 *
 * ## Motion
 *
 * The arc turns only under `motion-safe`. With reduced motion it holds
 * still, and the label still says it is loading: the turn adds nothing the
 * reader needs.
 *
 * ## Colour
 *
 * `currentColor`, so it takes the colour of the text around it, on a button,
 * a banner or plain body copy. The track is the same colour at low opacity.
 *
 * ## MIN_VIEWPORT — 320
 *
 * A fixed square at most 32px wide; it never wraps.
 *
 * | Rule | Concept                 | Where in this file                                |
 * | ---- | ----------------------- | ------------------------------------------------- |
 * | R4   | Extends native el       | `React.ComponentProps<'svg'> & VariantProps`      |
 * | R6   | data-slot               | `spinner`                                         |
 * | R7   | cva + cn + ...rest      | `cn(spinnerVariants({ size }), className)`        |
 * | R8   | Enums, not booleans     | `size` = sm \| md \| lg                           |
 * | R14  | Declares min viewport   | `data-min-viewport` + exported const              |
 * | R19  | Tokens only             | `currentColor`; `motion-safe:animate-spin`        |
 * | R25  | Server component        | no hooks → no `'use client'`                      |
 * | R26  | A11y                    | `role="status"` + `aria-label`, or `aria-hidden`  |
 */

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../lib/cn.js';

/** Minimum viable viewport (CSS px) for this primitive. */
export const MIN_VIEWPORT = 320 as const;

const spinnerVariants = cva('inline-block shrink-0 motion-safe:animate-spin', {
  variants: {
    size: {
      sm: 'size-4',
      md: 'size-6',
      lg: 'size-8',
    },
  },
  defaultVariants: { size: 'sm' },
});

type SpinnerProps = Omit<React.ComponentProps<'svg'>, 'children'> &
  VariantProps<typeof spinnerVariants> & {
    /** What is announced when the spinner appears, in the page's language. @default 'Loading' */
    label?: string;
    /**
     * Hide it from assistive tech, for a spinner inside something that already says it
     * is busy (a button with `aria-busy`). @default false
     */
    decorative?: boolean;
  };

function Spinner({ className, size, label = 'Loading', decorative = false, ...props }: SpinnerProps) {
  const a11y = decorative
    ? ({ 'aria-hidden': true } as const)
    : ({ role: 'status', 'aria-label': label } as const);
  return (
    <svg
      data-slot="spinner"
      data-min-viewport={String(MIN_VIEWPORT)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      focusable="false"
      className={cn(spinnerVariants({ size }), className)}
      {...a11y}
      {...props}
    >
      <circle cx="12" cy="12" r="9" opacity={0.2} />
      <path d="M21 12a9 9 0 0 0-9-9" />
    </svg>
  );
}

export { Spinner, spinnerVariants };
export type { SpinnerProps };
