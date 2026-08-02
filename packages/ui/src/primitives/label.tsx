/**
 * @interlace/ui — Label
 *
 * Form-control label. No headless dep — Base UI's `Field.Label` is the
 * forms-aware variant (see `form.tsx`); this is the lower-level shadcn-canon
 * label for controls that own their own id wiring. Server component.
 * Mirrors: https://ui.shadcn.com/docs/components/label
 *
 * ## Anatomy
 *
 *   <label data-slot="label" data-min-viewport="320">…</label>
 *
 * ## MIN_VIEWPORT — 320
 *
 * A label is text in flow; it wraps rather than overflows, so it inherits
 * the 320 floor of the control it names.
 *
 * ## Contrast
 *
 * Label text renders in the inherited `--foreground` — 19.65:1 light and
 * 16.97:1 dark on `--background`, both well past the 4.5:1 SC 1.4.3 floor.
 * The `peer-disabled` / `group-data-[disabled]` opacity ramps are exempt:
 * SC 1.4.3 carves out inactive user-interface components.
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends native el                | `React.ComponentProps<'label'>`                             |
 * | R6   | data-slot on the part            | `data-slot="label"`                                         |
 * | R7   | className merged + ...rest + ref | `cn(BASE, className)` + `{...props}` + forwarded ref        |
 * | R12  | Reuse over wrap                  | native `<label>` — no bespoke association machinery         |
 * | R14  | Declares min viewport            | `data-min-viewport={String(MIN_VIEWPORT)}` + exported const |
 * | R18  | Tailwind only                    | zero inline `style`                                         |
 * | R19  | Tokens only                      | `text-sm` / `gap-2` — scale tokens, no raw px               |
 * | R25  | Server component                 | no hooks → no `'use client'`                                |
 * | R26  | A11y from native el              | `<label htmlFor>` owns the control association              |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';

/** Smallest viable viewport (CSS px) for this primitive. */
export const MIN_VIEWPORT = 320 as const;

const Label = React.forwardRef<HTMLLabelElement, React.ComponentProps<'label'>>(
  function Label({ className, ...props }, ref) {
    return (
      <label
        ref={ref}
        data-slot="label"
        data-min-viewport={String(MIN_VIEWPORT)}
        className={cn(
          'flex select-none items-center gap-2 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50 group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50',
          className,
        )}
        {...props}
      />
    );
  },
);

export { Label };
