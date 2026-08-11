/**
 * @interlace/ui — Alert
 *
 * A bordered in-page message with `role="alert"`, an optional leading icon, a
 * title and a description, in two tones (default and destructive).
 *
 * The icon column exists only when a direct `<svg>` child does — `has-[>svg]`
 * switches the grid from `[0_1fr]` to two columns — so a text-only alert has
 * no empty gutter.
 *
 * ## Anatomy
 *
 *   Alert                            (div — role=alert, CSS grid)
 *     ├─ <svg>                       (optional, any icon; sizing is imposed here)
 *     ├─ AlertTitle                  (div — col-start-2)
 *     └─ AlertDescription            (div — col-start-2)
 *
 * The icon is styled by descendant selectors on the root (`[&>svg]:size-4`,
 * `translate-y-0.5`, `text-current`), so it must be a DIRECT child — an icon
 * wrapped in a span gets neither the sizing nor the grid column.
 *
 * ## Two things to know before reaching for it
 *
 *   - `role="alert"` is unconditional. It is an assertive live region, so this
 *     component is for a message that APPEARS in response to something. One
 *     rendered with the page competes with the page's own announcement.
 *   - `AlertTitle` is `line-clamp-1`. A title longer than one line is cut, not
 *     wrapped; the sentence belongs in `AlertDescription`.
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends native el                | `React.ComponentProps<'div'>` on all three parts            |
 * | R6   | data-slot per part               | alert / alert-title / alert-description                     |
 * | R7   | cva + cn + ...rest               | `cn(alertVariants({ variant }), className)` + `{...props}`  |
 * | R8   | Enum for tone                    | `variant = default | destructive` — no `isError` boolean    |
 * | R19  | Tokens only                      | `bg-card`, `text-card-foreground`, `text-destructive`       |
 * | R25  | Server component                 | No hooks → no `'use client'`                                |
 * | R26  | A11y                             | `role="alert"` on the root; the icon inherits `text-current` |
 */

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../lib/cn.js';

const alertVariants = cva(
  'relative w-full rounded-lg border px-4 py-3 text-sm grid has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] grid-cols-[0_1fr] has-[>svg]:gap-x-3 gap-y-0.5 items-start [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current',
  {
    variants: {
      variant: {
        default: 'bg-card text-card-foreground',
        destructive:
          'text-destructive bg-card [&>svg]:text-current *:data-[slot=alert-description]:text-destructive',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        'col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight',
        className,
      )}
      {...props}
    />
  );
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        'text-muted-foreground col-start-2 grid justify-items-start gap-1 text-sm [&_p]:leading-relaxed',
        className,
      )}
      {...props}
    />
  );
}

export { Alert, AlertTitle, AlertDescription, alertVariants };
