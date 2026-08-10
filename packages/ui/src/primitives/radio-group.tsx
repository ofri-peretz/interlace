'use client';

/**
 * @interlace/ui — RadioGroup
 *
 * Single-select control over 2+ mutually exclusive options. Built on
 * @base-ui/react/radio-group + /radio: Base UI owns `role="radiogroup"`,
 * roving-tabindex arrow navigation, and the controlled/uncontrolled pair
 * (`value` + `onValueChange` / `defaultValue`).
 * Mirrors: https://base-ui.com/react/components/radio
 *
 * ## Anatomy
 *
 *   RadioGroup (Root)             (div[role=radiogroup] — data-min-viewport=320)
 *     └─ RadioGroupItem           (button[role=radio]) — repeats
 *         └─ (indicator dot)
 *
 * ## Keyboard (owned by Base UI, asserted in RadioGroup.stories.tsx)
 *
 * | Key                | Action                                          |
 * | ------------------ | ----------------------------------------------- |
 * | Tab                | Move into the group, landing on the checked item |
 * | ↓ / →              | Select the next item (wraps)                     |
 * | ↑ / ←              | Select the previous item (wraps)                 |
 * | Space              | Select the focused item                          |
 *
 * ## MIN_VIEWPORT — 320
 *
 * ## Target size (SC 2.5.8, AA)
 *
 * The painted dot is 16×16 CSS px; a transparent `before:` pseudo-element
 * extends the hit area to 24×24. The group's `gap-2` (8px) leaves a 24px
 * pitch, so the enlarged targets tile without overlapping.
 *
 * ## Contrast (verified by token math)
 *
 * | Composite                                          | Light  | Dark    | Floor           |
 * | -------------------------------------------------- | ------ | ------- | --------------- |
 * | unchecked `border-input` on `--background`         | 3.62:1 | 3.35:1  | 3:1 (SC 1.4.11) |
 * | checked dot `fill-primary` on `--background`       | 8.80:1 | 11.79:1 | 3:1 (SC 1.4.11) |
 * | `aria-invalid:border-destructive` on `--background`| 8.31:1 | 10.43:1  | 3:1 (SC 1.4.11) |
 * | `focus-visible:ring-ring/60` on `--background`     | 3.23:1 | 4.73:1  | 3:1 (SC 2.4.13) |
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends Base UI part props       | each wrapper extends its Base UI part's props               |
 * | R6   | data-slot per part               | `radio-group` / `-item` / `-indicator`                      |
 * | R7   | className merged + ...rest + ref | `cn(BASE, className)` + `{...props}` + forwarded ref        |
 * | R11  | Composition over prop-drilling   | items are children, not an `options` array prop             |
 * | R12  | Reuse over wrap                  | Base UI owns roving tabindex + ARIA                         |
 * | R14  | Declares min viewport            | `data-min-viewport={String(MIN_VIEWPORT)}` + exported const |
 * | R18  | Tailwind only                    | zero inline `style`                                         |
 * | R19  | Tokens only                      | `border-input` / `fill-primary` / `ring-ring`               |
 * | R20  | AA contrast                      | table above — every composite measured                      |
 * | R25  | Client component                 | required — Base UI RadioGroup ships client hooks            |
 * | R26  | A11y from upstream               | `role="radiogroup"` + arrow-key roving tabindex             |
 */

import * as React from 'react';
import { RadioGroup as BaseRadioGroup } from '@base-ui/react/radio-group';
import { Radio } from '@base-ui/react/radio';
import { CircleIcon } from 'lucide-react';

import { cn } from '../lib/cn.js';

/** Smallest viable viewport (CSS px) for this primitive. */
export const MIN_VIEWPORT = 320 as const;

const RadioGroup = React.forwardRef<
  React.ElementRef<typeof BaseRadioGroup>,
  React.ComponentProps<typeof BaseRadioGroup>
>(function RadioGroup({ className, ...props }, ref) {
  return (
    <BaseRadioGroup
      ref={ref}
      data-slot="radio-group"
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('grid gap-2', className)}
      {...props}
    />
  );
});

const RadioGroupItem = React.forwardRef<
  React.ElementRef<typeof Radio.Root>,
  React.ComponentProps<typeof Radio.Root>
>(function RadioGroupItem({ className, ...props }, ref) {
  return (
    <Radio.Root
      ref={ref}
      data-slot="radio-group-item"
      className={cn(
        'border-input text-primary dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/60 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive aspect-square size-4 shrink-0 rounded-full border shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50',
        // SC 2.5.8 — transparent 24×24 hit area around the 16px dot.
        "relative before:absolute before:-inset-1 before:content-['']",
        className,
      )}
      {...props}
      /**
       * Base UI emits `aria-readonly` on this element unconditionally when the
       * group is read-only (see RadioRoot.js `rootProps`), but ARIA 1.2 does
       * not list `aria-readonly` as supported on `role="radio"` — only on
       * `role="radiogroup"`. axe flags it CRITICAL (`aria-allowed-attr`).
       *
       * Nothing is lost by removing it: Base UI ALSO sets `aria-readonly` on
       * the radiogroup root, which is the conformant place for it, so the
       * read-only semantic still reaches assistive tech. External props merge
       * after Base UI's internal `rootProps`, so this wins.
       */
      aria-readonly={undefined}
    >
      <Radio.Indicator
        data-slot="radio-group-indicator"
        className="relative flex items-center justify-center"
      >
        <CircleIcon className="fill-primary absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2" />
      </Radio.Indicator>
    </Radio.Root>
  );
});

export { RadioGroup, RadioGroupItem };
