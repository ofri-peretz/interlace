'use client';

/**
 * @interlace/ui — Checkbox
 *
 * Tri-state boolean form control (checked / unchecked / indeterminate).
 * Built on @base-ui/react/checkbox: Base UI owns `role="checkbox"`,
 * `aria-checked="mixed"`, Space activation, and the controlled/uncontrolled
 * pair (`checked` + `onCheckedChange` / `defaultChecked`).
 * Mirrors: https://base-ui.com/react/components/checkbox
 *
 * ## Anatomy
 *
 *   Checkbox (Root)               (button[role=checkbox] — data-min-viewport=320)
 *     └─ CheckboxIndicator        (Check / Minus glyph)
 *
 * ## MIN_VIEWPORT — 320
 *
 * ## Target size (SC 2.5.8, AA)
 *
 * The painted box is 16×16 CSS px. Rather than lean on the spacing
 * exception (a 24px circle must not intersect a neighbour's — true only
 * while callers keep ≥8px gaps, which the DS cannot enforce at the call
 * site), a transparent `before:` pseudo-element extends the hit area to
 * 24×24. Visual unchanged; the target genuinely measures 24px.
 *
 * ## Contrast (verified by token math)
 *
 * | Composite                                          | Light  | Dark    | Floor           |
 * | -------------------------------------------------- | ------ | ------- | --------------- |
 * | unchecked `border-input` on `--background`         | 3.62:1 | 3.35:1  | 3:1 (SC 1.4.11) |
 * | checked `bg-primary` on `--background`             | 8.80:1 | 11.79:1 | 3:1 (SC 1.4.11) |
 * | glyph `text-primary-foreground` on `bg-primary`    | 8.80:1 | 11.79:1 | 3:1 (SC 1.4.11) |
 * | `aria-invalid:border-destructive` on `--background`| 8.31:1 | 10.43:1  | 3:1 (SC 1.4.11) |
 * | `focus-visible:ring-ring/60` on `--background`     | 3.23:1 | 4.73:1  | 3:1 (SC 2.4.13) |
 *
 * `disabled:opacity-50` is exempt — SC 1.4.11 carves out inactive
 * user-interface components.
 *
 * ## API parity
 *
 * `rounded-[4px]` is an arbitrary radius: the DS radius scale starts at
 * `--interlace-radius-sm` = 8px, which fully rounds a 16px box into a
 * squircle. Kept for shadcn parity until the scale grows an `xs` step.
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends Base UI part props       | `React.ComponentProps<typeof BaseCheckbox.Root>`            |
 * | R6   | data-slot per part               | `checkbox` / `checkbox-indicator`                           |
 * | R7   | className merged + ...rest + ref | `cn(BASE, className)` + `{...props}` + forwarded ref        |
 * | R12  | Reuse over wrap                  | Base UI owns state, keyboard and ARIA                       |
 * | R14  | Declares min viewport            | `data-min-viewport={String(MIN_VIEWPORT)}` + exported const |
 * | R18  | Tailwind only                    | zero inline `style`                                         |
 * | R19  | Tokens only                      | semantic colour tokens (1 documented radius deviation)      |
 * | R20  | AA contrast                      | table above — every composite measured                      |
 * | R25  | Client component                 | required — Base UI Checkbox ships client hooks              |
 * | R26  | A11y from upstream               | `role="checkbox"` + `aria-checked` (incl. `mixed`) + Space  |
 */

import * as React from 'react';
import { Checkbox as BaseCheckbox } from '@base-ui/react/checkbox';
import { CheckIcon, MinusIcon } from 'lucide-react';

import { cn } from '../lib/cn.js';

/** Smallest viable viewport (CSS px) for this primitive. */
export const MIN_VIEWPORT = 320 as const;

const Checkbox = React.forwardRef<
  React.ElementRef<typeof BaseCheckbox.Root>,
  React.ComponentProps<typeof BaseCheckbox.Root>
>(function Checkbox({ className, ...props }, ref) {
  return (
    <BaseCheckbox.Root
      ref={ref}
      data-slot="checkbox"
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn(
        'peer border-input dark:bg-input/30 data-[checked]:bg-primary data-[checked]:text-primary-foreground dark:data-[checked]:bg-primary data-[checked]:border-primary focus-visible:border-ring focus-visible:ring-ring/60 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive size-4 shrink-0 rounded-[4px] border shadow-xs transition-shadow outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50',
        // SC 2.5.8 — transparent 24×24 hit area around the 16px box.
        "relative before:absolute before:-inset-1 before:content-['']",
        className,
      )}
      {...props}
    >
      <BaseCheckbox.Indicator
        data-slot="checkbox-indicator"
        className="flex items-center justify-center text-current transition-none"
      >
        {props.indeterminate ? (
          <MinusIcon className="size-3.5" />
        ) : (
          <CheckIcon className="size-3.5" />
        )}
      </BaseCheckbox.Indicator>
    </BaseCheckbox.Root>
  );
});

export { Checkbox };
