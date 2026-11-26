'use client';

/**
 * @interlace/ui — OtpField
 *
 * A one-time code typed into a row of boxes, one character each: the "enter
 * the 6-digit code we emailed you" field. Built on Base UI's OTPField, which
 * owns the hard parts: paste of the whole code into any box, the phone's
 * "from Messages" autofill (`autocomplete="one-time-code"` on the first box),
 * arrow and backspace movement, and a hidden input that carries the value
 * into a form under `name`.
 *
 * ## Anatomy
 *
 *   OtpField                         (div — data-slot="otp-field", data-complete, data-filled)
 *     ├─ OTPField.Input × length     (data-slot="otp-field-slot", data-filled)
 *     └─ OTPField.Separator          (data-slot="otp-field-separator" — between groups, when `groupSize` is set)
 *
 * ## Groups
 *
 * `groupSize={3}` splits a six-digit code into 3 + 3 with a short dash
 * between, which is how people read a code aloud. The dash is decorative.
 *
 * ## States
 *
 * A filled box gets a stronger border; the focused one the focus ring. When
 * `invalid` is set every box turns to the destructive border and carries
 * `aria-invalid`, so pair it with an error message the field is described
 * by. When the last box fills, `onValueComplete` fires; `autoSubmit`
 * submits the owning form instead.
 *
 * ## MIN_VIEWPORT — 320
 *
 * Six 2.75rem boxes with 0.5rem gaps are 19rem: they fit a 320px screen with
 * its gutters. Eight boxes or more should use `size="sm"`.
 *
 * | Rule | Concept                 | Where in this file                                          |
 * | ---- | ----------------------- | ----------------------------------------------------------- |
 * | R4   | Extends the Base UI root | `OTPField.Root.Props` minus `children`                     |
 * | R6   | data-slot per part      | otp-field / -slot / -separator                              |
 * | R7   | cn + ...rest            | `cn(…, className)` + `{...props}`                           |
 * | R8   | Enums, not booleans     | `size` is `sm \| default`                                   |
 * | R12  | Reuse over wrap         | Base UI owns paste, autofill, focus movement, hidden input  |
 * | R14  | Declares min viewport   | `data-min-viewport` + exported const                        |
 * | R18  | Tailwind only           | no inline style                                             |
 * | R19  | Tokens only             | `border-input`, `ring-ring`, `border-destructive`           |
 * | R25  | Client component        | Base UI state machine                                       |
 * | R26  | A11y                    | first box takes the field's label; the rest are "Character n of N" |
 */

import * as React from 'react';
import { OTPField } from '@base-ui/react/otp-field';

import { cn } from '../lib/cn.js';

export const MIN_VIEWPORT = 320 as const;

type OtpFieldProps = Omit<
  React.ComponentProps<typeof OTPField.Root>,
  'children' | 'length' | 'className'
> & {
  className?: string;
  /** Number of boxes. @default 6 */
  length?: number;
  /** Put a dash after every `groupSize` boxes, such as 3 for "123–456". */
  groupSize?: number;
  /** @default 'default' */
  size?: 'sm' | 'default';
  /** Shows every box as invalid and sets `aria-invalid`. */
  invalid?: boolean;
  /** Accessible name of boxes 2…n. @default (n, total) => `Character ${n} of ${total}` */
  slotLabel?: (n: number, total: number) => string;
};

const SLOT =
  'border-input bg-background text-foreground rounded-lg border text-center font-medium tabular-nums shadow-xs outline-none ' +
  'transition-[border-color,box-shadow,transform] duration-(--duration-fast) ' +
  'data-filled:border-foreground/40 motion-safe:data-filled:scale-[1.04] ' +
  'focus-visible:border-ring focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:scale-100 ' +
  'aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

const SIZE = {
  sm: 'h-10 w-9 min-w-0 shrink text-base',
  default: 'h-12 w-11 min-w-0 shrink text-xl',
} as const;

function OtpField({
  className,
  length = 6,
  groupSize,
  size = 'default',
  invalid = false,
  slotLabel = (n, total) => `Character ${n} of ${total}`,
  ...props
}: OtpFieldProps) {
  const slots: React.ReactNode[] = [];
  for (let i = 0; i < length; i++) {
    if (groupSize && i > 0 && i % groupSize === 0) {
      slots.push(
        <OTPField.Separator
          key={`sep-${i}`}
          data-slot="otp-field-separator"
          className="bg-muted-foreground/60 mx-1 h-0.5 w-3 shrink-0 rounded-full"
        />,
      );
    }
    slots.push(
      <OTPField.Input
        key={i}
        data-slot="otp-field-slot"
        aria-label={i === 0 ? undefined : slotLabel(i + 1, length)}
        aria-invalid={invalid || undefined}
        className={cn(SLOT, SIZE[size])}
      />,
    );
  }

  return (
    <OTPField.Root
      length={length}
      data-slot="otp-field"
      data-size={size}
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('flex max-w-full items-center gap-2', className)}
      {...props}
    >
      {slots}
    </OTPField.Root>
  );
}

export { OtpField };
export type { OtpFieldProps };
