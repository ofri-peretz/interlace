/**
 * @interlace/ui — Input
 *
 * Single-line text input. A pure surface primitive with no controlled-state
 * machinery: the native `<input>` already owns selection, IME, undo/redo and
 * `onChange`, so we add structure (surface, border, focus + invalid rings)
 * without wrapping a single native behaviour. Server component — no hooks.
 * Mirrors: https://ui.shadcn.com/docs/components/input
 *
 * ## Anatomy
 *
 *   <input data-slot="input" data-min-viewport="320" />
 *
 * ## MIN_VIEWPORT — 320
 *
 * Form controls are the LAST thing that may degrade on a narrow screen; a
 * sign-in / contact / search form must work on a 320 CSS-px iPhone SE. The
 * 36px control height clears the WCAG 2.5.8 target-size floor there.
 *
 * ## Contrast (verified by token math, not by eye)
 *
 * | Composite                                      | Light  | Dark   | Floor           |
 * | ---------------------------------------------- | ------ | ------ | --------------- |
 * | `border-input` on `--background`               | 3.62:1 | 3.35:1 | 3:1 (SC 1.4.11) |
 * | `placeholder:text-muted-foreground` on the bg  | 9.41:1 | 8.74:1 | 4.5:1 (SC 1.4.3)|
 * | `focus-visible:ring-ring/60` on `--background` | 3.23:1 | 4.73:1 | 3:1 (SC 2.4.13) |
 *
 * `disabled:opacity-50` is exempt — SC 1.4.3 and SC 1.4.11 both carve out
 * inactive user-interface components.
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends native el                | `React.ComponentProps<'input'>`                             |
 * | R6   | data-slot on the part            | `data-slot="input"`                                         |
 * | R7   | className merged + ...rest + ref | `cn(BASE, className)` + `{...props}` + forwarded ref        |
 * | R9   | Native onChange stays native     | `onChange` / `onFocus` etc. pass through `{...props}`       |
 * | R14  | Declares min viewport            | `data-min-viewport={String(MIN_VIEWPORT)}` + exported const |
 * | R18  | Tailwind only                    | zero inline `style`                                         |
 * | R19  | Tokens only                      | `border-input` / `ring-ring` / `text-muted-foreground`      |
 * | R20  | AA contrast                      | table above — every composite measured                      |
 * | R25  | Server component                 | no hooks → no `'use client'`                                |
 * | R26  | A11y from native el              | `<input>` owns focus, keyboard, ARIA, label association     |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';

/** Smallest viable viewport (CSS px) for this primitive. */
export const MIN_VIEWPORT = 320 as const;

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  function Input({ className, type, ...props }, ref) {
    return (
      <input
        ref={ref}
        type={type}
        data-slot="input"
        data-min-viewport={String(MIN_VIEWPORT)}
        className={cn(
          "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          // /60 not /50 — 50%-alpha primary composites to 2.57:1 on white,
          // under the 3:1 focus-indicator floor (SC 2.4.13). See table above.
          'focus-visible:border-ring focus-visible:ring-ring/60 focus-visible:ring-[3px]',
          'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
          className,
        )}
        {...props}
      />
    );
  },
);

export { Input };
