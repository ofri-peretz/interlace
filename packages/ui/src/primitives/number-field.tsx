'use client';

/**
 * @interlace/ui — NumberField
 *
 * A numeric input with increment/decrement controls and built-in scrubbing.
 * Wraps @base-ui/react/number-field. Re-exports the compositional parts
 * (Root, Group, Increment, Input, Decrement, ScrubArea) under DS-styled
 * wrappers without owning state.
 *
 * ## Anatomy
 *
 *   NumberField (Root)               (div — data-min-viewport=320)
 *     ├─ NumberFieldScrubArea       (optional drag-to-scrub region)
 *     └─ NumberFieldGroup            (the visible button group)
 *         ├─ NumberFieldDecrement   (minus button)
 *         ├─ NumberFieldInput        (the actual number input)
 *         └─ NumberFieldIncrement    (plus button)
 *
 * ## MIN_VIEWPORT — 320
 *
 * ## Target size (SC 2.5.8, AA)
 *
 * The increment / decrement buttons are `w-9` (36px) against the input's
 * `h-9` (36px) — 36×36, comfortably past the 24×24 floor with no
 * pseudo-element hit area needed. Native keyboard (Up/Down arrows)
 * inherited from Base UI.
 *
 * ## Contrast (verified by token math)
 *
 * | Composite                                       | Light   | Dark    | Floor           |
 * | ----------------------------------------------- | ------- | ------- | --------------- |
 * | group `border-input` on `--background`          | 3.62:1  | 3.35:1  | 3:1 (SC 1.4.11) |
 * | value text `--foreground` on `bg-background`    | 19.65:1 | 16.97:1 | 4.5:1 (SC 1.4.3)|
 * | `focus-within:ring-ring` on `--background`      | 8.80:1  | 11.79:1 | 3:1 (SC 2.4.13) |
 *
 * The ring here is full-opacity (not the `/60` alpha the flat-surface
 * controls use), so it clears the focus floor with room to spare.
 * `disabled:opacity-50` is exempt (inactive component).
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends Base UI part props       | each wrapper extends `React.ComponentProps<typeof BaseNF.X>` |
 * | R6   | data-slot per part               | number-field / -group / -input / -increment / -decrement    |
 * | R7   | cn + ...rest                     | `cn(BASE, className)` + `{...props}`                        |
 * | R12  | Reuse over wrap                  | Base UI owns scrub + keyboard + clamping                    |
 * | R14  | Declares min viewport            | `data-min-viewport={String(MIN_VIEWPORT)}` + exported const |
 * | R19  | Tokens only                      | border-input, bg-background, ring-ring — semantic tokens    |
 * | R25  | Client component                 | Required — Base UI NumberField ships client hooks           |
 * | R26  | A11y from upstream               | aria-valuenow, aria-valuemin, aria-valuemax handled         |
 */

import * as React from 'react';
import { NumberField as BaseNumberField } from '@base-ui/react/number-field';

import { cn } from '../lib/cn.js';

export const MIN_VIEWPORT = 320 as const;

const NumberField = React.forwardRef<
  React.ElementRef<typeof BaseNumberField.Root>,
  React.ComponentProps<typeof BaseNumberField.Root>
>(({ className, ...props }, ref) => (
  <BaseNumberField.Root
    ref={ref}
    data-slot="number-field"
    data-min-viewport={String(MIN_VIEWPORT)}
    className={cn('inline-flex items-stretch', className)}
    {...props}
  />
));
NumberField.displayName = 'NumberField';

const NumberFieldGroup = React.forwardRef<
  React.ElementRef<typeof BaseNumberField.Group>,
  React.ComponentProps<typeof BaseNumberField.Group>
>(({ className, ...props }, ref) => (
  <BaseNumberField.Group
    ref={ref}
    data-slot="number-field-group"
    className={cn(
      'border-input bg-background flex items-stretch overflow-hidden rounded-md border shadow-sm',
      'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
      className,
    )}
    {...props}
  />
));
NumberFieldGroup.displayName = 'NumberFieldGroup';

const NumberFieldInput = React.forwardRef<
  React.ElementRef<typeof BaseNumberField.Input>,
  React.ComponentProps<typeof BaseNumberField.Input>
>(({ className, ...props }, ref) => (
  <BaseNumberField.Input
    ref={ref}
    data-slot="number-field-input"
    className={cn(
      'h-9 w-20 bg-transparent px-3 text-center text-sm tabular-nums',
      'focus:outline-none disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  />
));
NumberFieldInput.displayName = 'NumberFieldInput';

const NumberFieldIncrement = React.forwardRef<
  React.ElementRef<typeof BaseNumberField.Increment>,
  React.ComponentProps<typeof BaseNumberField.Increment>
>(({ className, ...props }, ref) => (
  <BaseNumberField.Increment
    ref={ref}
    data-slot="number-field-increment"
    className={cn(
      'border-input hover:bg-muted active:bg-accent flex w-9 cursor-pointer items-center justify-center border-l text-sm transition-colors',
      'disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  />
));
NumberFieldIncrement.displayName = 'NumberFieldIncrement';

const NumberFieldDecrement = React.forwardRef<
  React.ElementRef<typeof BaseNumberField.Decrement>,
  React.ComponentProps<typeof BaseNumberField.Decrement>
>(({ className, ...props }, ref) => (
  <BaseNumberField.Decrement
    ref={ref}
    data-slot="number-field-decrement"
    className={cn(
      'border-input hover:bg-muted active:bg-accent flex w-9 cursor-pointer items-center justify-center border-r text-sm transition-colors',
      'disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  />
));
NumberFieldDecrement.displayName = 'NumberFieldDecrement';

const NumberFieldScrubArea = React.forwardRef<
  React.ElementRef<typeof BaseNumberField.ScrubArea>,
  React.ComponentProps<typeof BaseNumberField.ScrubArea>
>(({ className, ...props }, ref) => (
  <BaseNumberField.ScrubArea
    ref={ref}
    data-slot="number-field-scrub-area"
    className={cn('cursor-ew-resize', className)}
    {...props}
  />
));
NumberFieldScrubArea.displayName = 'NumberFieldScrubArea';

export {
  NumberField,
  NumberFieldGroup,
  NumberFieldInput,
  NumberFieldIncrement,
  NumberFieldDecrement,
  NumberFieldScrubArea,
};
