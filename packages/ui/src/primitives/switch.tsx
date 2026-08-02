'use client';

/**
 * @interlace/ui — Switch
 *
 * Binary on/off control with immediate effect (no submit step) — the
 * distinction from Checkbox, which collects a value for a form. Built on
 * @base-ui/react/switch: Base UI owns `role="switch"`, `aria-checked`,
 * Space/Enter activation and the controlled/uncontrolled pair
 * (`checked` + `onCheckedChange` / `defaultChecked`).
 * Mirrors: https://base-ui.com/react/components/switch
 *
 * ## Anatomy
 *
 *   Switch (Root)                 (button[role=switch] — data-min-viewport=320)
 *     └─ SwitchThumb              (the sliding knob)
 *
 * ## MIN_VIEWPORT — 320
 *
 * ## Target size (SC 2.5.8, AA)
 *
 * The painted track is 32×18.4 CSS px — under the 24px vertical floor. A
 * transparent `before:` pseudo-element extends the hit area to the full
 * 32×24 without changing a pixel of the visual. Not a spacing-exception
 * gamble: the target itself measures ≥24px.
 *
 * ## Contrast (verified by token math)
 *
 * | Composite                                       | Light  | Dark   | Floor           |
 * | ----------------------------------------------- | ------ | ------ | --------------- |
 * | unchecked track `bg-input` on `--background`    | 3.62:1 | 3.35:1 | 3:1 (SC 1.4.11) |
 * | checked track `bg-primary` on `--background`    | 8.80:1 | 11.79:1| 3:1 (SC 1.4.11) |
 * | thumb on unchecked track                        | 3.62:1 | 5.06:1 | 3:1 (SC 1.4.11) |
 * | thumb on checked track                          | 8.80:1 | 11.79:1| 3:1 (SC 1.4.11) |
 * | `focus-visible:ring-ring/60` on `--background`  | 3.23:1 | 4.73:1 | 3:1 (SC 2.4.13) |
 *
 * The dark unchecked track previously carried `bg-input/80`, which
 * composited to 1.17:1 — the off state was invisible on dark. Dropped:
 * the full-strength token is the one that was measured.
 *
 * ## API parity
 *
 * `h-[1.15rem]` is an arbitrary value with no matching spacing token. Kept
 * deliberately for pixel parity with the shadcn canon (a 20px track leaves
 * visible slack around the 16px thumb); the DS spacing scale has no
 * 18.4px step to reach for.
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends Base UI part props       | `React.ComponentProps<typeof BaseSwitch.Root>`              |
 * | R6   | data-slot per part               | `switch` / `switch-thumb`                                   |
 * | R7   | className merged + ...rest + ref | `cn(BASE, className)` + `{...props}` + forwarded ref        |
 * | R12  | Reuse over wrap                  | Base UI owns state, keyboard and ARIA                       |
 * | R14  | Declares min viewport            | `data-min-viewport={String(MIN_VIEWPORT)}` + exported const |
 * | R18  | Tailwind only                    | zero inline `style`                                         |
 * | R19  | Tokens only                      | `bg-input` / `bg-primary` / `ring-ring` (1 documented dev.) |
 * | R20  | AA contrast                      | table above — every composite measured                      |
 * | R25  | Client component                 | required — Base UI Switch ships client hooks                |
 * | R26  | A11y from upstream               | `role="switch"` + `aria-checked` + Space/Enter              |
 */

import * as React from 'react';
import { Switch as BaseSwitch } from '@base-ui/react/switch';

import { cn } from '../lib/cn.js';

/** Smallest viable viewport (CSS px) for this primitive. */
export const MIN_VIEWPORT = 320 as const;

const Switch = React.forwardRef<
  React.ElementRef<typeof BaseSwitch.Root>,
  React.ComponentProps<typeof BaseSwitch.Root>
>(function Switch({ className, ...props }, ref) {
  return (
    <BaseSwitch.Root
      ref={ref}
      data-slot="switch"
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn(
        'peer data-[checked]:bg-primary data-[unchecked]:bg-input focus-visible:border-ring focus-visible:ring-ring/60 inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50',
        // SC 2.5.8 — transparent 32×24 hit area centred on the 18.4px track.
        "relative before:absolute before:top-1/2 before:left-0 before:h-6 before:w-full before:-translate-y-1/2 before:content-['']",
        className,
      )}
      {...props}
    >
      <BaseSwitch.Thumb
        data-slot="switch-thumb"
        className={cn(
          'bg-background dark:data-[checked]:bg-primary-foreground dark:data-[unchecked]:bg-foreground pointer-events-none block size-4 rounded-full ring-0 transition-transform data-[checked]:translate-x-[calc(100%-2px)] data-[unchecked]:translate-x-0',
        )}
      />
    </BaseSwitch.Root>
  );
});

export { Switch };
