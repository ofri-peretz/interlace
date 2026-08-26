'use client';

/**
 * @interlace/ui — Toggle + ToggleGroup
 *
 * A two-state button (pressed / not-pressed) and a grouped form thereof
 * (mutually-exclusive or multi-select). Wraps @base-ui/react/toggle and
 * @base-ui/react/toggle-group; we own the surface (size, variant, focus
 * ring) and Base UI owns the pressed-state machinery + ARIA.
 *
 * ## Anatomy
 *
 *   Toggle                           (button — data-min-viewport=320)
 *     └─ children                    (icon / text)
 *
 *   ToggleGroup                      (div — data-min-viewport=320, role=group or radiogroup)
 *     ├─ ToggleGroupItem
 *     ├─ ToggleGroupItem
 *     └─ ToggleGroupItem
 *
 * ## MIN_VIEWPORT — 320
 *
 * Toggles must reach the WCAG 2.2 SC 2.5.8 target-size floor (24×24 CSS
 * px, AA). `xs` — the pill's native size — sits exactly on that floor
 * (min-h-6); `sm` and up clear it with room.
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends Base UI part props       | wrappers extend `React.ComponentProps<typeof BaseToggle/etc>` |
 * | R6   | data-slot per part               | toggle / toggle-group / toggle-group-item                   |
 * | R7   | cva + cn + ...rest               | `cn(toggleVariants({size,variant}), className)` + `{...props}` |
 * | R8   | Enums for size / variant         | size = xs|sm|md|lg; variant = default|outline|pill          |
 * | R12  | Reuse over wrap                  | Base UI owns pressed state + ARIA                           |
 * | R14  | Declares min viewport            | `data-min-viewport={String(MIN_VIEWPORT)}` + exported const |
 * | R19  | Tokens only                      | bg-muted, bg-accent, text-foreground — semantic tokens      |
 * | R25  | Client component                 | Required — Base UI Toggle ships client hooks                |
 * | R26  | A11y from upstream               | role=button + aria-pressed handled by Base UI               |
 */

import * as React from 'react';
import { Toggle as BaseToggle } from '@base-ui/react/toggle';
import { ToggleGroup as BaseToggleGroup } from '@base-ui/react/toggle-group';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../lib/cn.js';

export const MIN_VIEWPORT = 320 as const;

const toggleVariants = cva(
  cn(
    'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors',
    'hover:bg-muted hover:text-muted-foreground',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    'disabled:pointer-events-none disabled:opacity-50',
    'data-[pressed]:bg-accent data-[pressed]:text-accent-foreground',
  ),
  {
    variants: {
      variant: {
        default: 'bg-transparent',
        outline: 'border-border bg-transparent border shadow-sm hover:bg-accent hover:text-accent-foreground',
        /**
         * The filter pill — the DS's one chip-shaped toggle, extracted
         * from TimelineMap.Filter so every "which threads/categories
         * are active" surface styles from a single home. Pressed state
         * is the strand-a tint (the brand-accent rule: strand color on
         * interactive surfaces only); identity survives greyscale via
         * the border-weight change, not hue alone. Overrides of the
         * base's hover/pressed washes resolve through tailwind-merge —
         * variant classes come after base in the cva output, so the
         * later utility wins.
         */
        pill: cn(
          'rounded-full border border-border text-muted-foreground',
          'hover:bg-transparent hover:text-foreground',
          'data-[pressed]:border-strand-a/50 data-[pressed]:bg-strand-a/10 data-[pressed]:text-foreground',
        ),
      },
      size: {
        /**
         * The pill's native size: min-h-6 is the 24px WCAG 2.2 SC 2.5.8
         * (AA) target floor — the same floor the TimelineMap chips were
         * audited against at every viewport (a bare px-2.5/py-0.5 pill
         * rendered 22px tall). min-height, not height, so a wrapped
         * label grows the pill instead of clipping.
         */
        xs: 'min-h-6 px-2.5 py-0.5 text-xs',
        sm: 'h-8 px-2',
        md: 'h-9 px-3',
        lg: 'h-10 px-4',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
);

type ToggleProps = React.ComponentProps<typeof BaseToggle> &
  VariantProps<typeof toggleVariants>;

const Toggle = React.forwardRef<
  React.ElementRef<typeof BaseToggle>,
  ToggleProps
>(({ className, variant, size, ...props }, ref) => (
  <BaseToggle
    ref={ref}
    data-slot="toggle"
    data-min-viewport={String(MIN_VIEWPORT)}
    className={cn(toggleVariants({ variant, size, className }))}
    {...props}
  />
));
Toggle.displayName = 'Toggle';

const ToggleGroup = React.forwardRef<
  React.ElementRef<typeof BaseToggleGroup>,
  React.ComponentProps<typeof BaseToggleGroup>
>(({ className, ...props }, ref) => (
  <BaseToggleGroup
    ref={ref}
    data-slot="toggle-group"
    data-min-viewport={String(MIN_VIEWPORT)}
    // Base UI renders the wrapper as `role="group" aria-orientation="…"`,
    // but ARIA 1.2 says `group` does NOT allow `aria-orientation` (only
    // toolbar / radiogroup / menu / tree / listbox / select / tablist /
    // separator / slider / scrollbar do). Promote the role to `toolbar`
    // so the orientation announcement is valid AND the surface still
    // reads as a self-contained group of related controls.
    role="toolbar"
    className={cn('inline-flex items-center', className)}
    {...props}
  />
));
ToggleGroup.displayName = 'ToggleGroup';

// ToggleGroup uses Toggle children — there is no separate "Item" primitive in
// Base UI's toggle-group API. Consumers compose <ToggleGroup><Toggle .../></ToggleGroup>.

export { Toggle, ToggleGroup, toggleVariants };
export type { ToggleProps };
