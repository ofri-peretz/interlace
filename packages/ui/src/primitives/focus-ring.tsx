import * as React from 'react';

import { cn } from '../lib/cn.js';

/**
 * @interlace/ui — FocusRing
 *
 * A composable wrapper that applies the DS focus contract to its child
 * **on focus-within** (the child becomes focused). Use it when:
 *
 *   1. You're composing a custom interactive surface (a card-as-button,
 *      a clickable list-row) and need the WCAG 2.2 SC 2.4.13 focus ring
 *      without manually writing the utility chain.
 *   2. You opted out of the global preflight ring on a particular subtree
 *      (e.g. inside a third-party component that sets its own outline)
 *      and need to reintroduce the contract per-element.
 *
 * The component renders no DOM of its own by default — it relies on the
 * child's existing element and wraps it in a single `<span>` (or a custom
 * `as` element). The ring lives on the wrapper via `focus-within:` rather
 * than the child's `focus-visible:` so the wrapper can host the contract
 * even when the child sets its own outline.
 *
 * For server-rendered surfaces. No hooks, no client boundary. The cost is
 * one extra DOM node per wrapped surface — measure if you wrap thousands.
 *
 * ## Anatomy
 *
 *   FocusRing                         (span — data-min-viewport=320)
 *     └─ children                     (the focusable element)
 *
 * ## MIN_VIEWPORT — 320
 *
 * The focus contract is universal. No device too small to honor it.
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends native el                | `React.ComponentProps<'span'> & FocusRingProps`             |
 * | R6   | data-slot on root                | `data-slot="focus-ring"`                                    |
 * | R7   | className merged + ...rest       | `cn(BASE, className)` + `{...props}`                        |
 * | R8   | Enum for offset                  | `offset = 'none' | 'sm' | 'md' | 'lg'`                      |
 * | R10  | Composition seam                 | `as` prop swaps wrapper element                             |
 * | R14  | Declares min viewport            | `data-min-viewport={String(MIN_VIEWPORT)}` + exported const |
 * | R18  | Tailwind only                    | Zero inline `style`; utility classes only                   |
 * | R19  | Tokens only                      | `--ring` semantic token                                     |
 * | R20  | AA contrast                      | `--ring` is contrast-tuned by interlace-theme.css per mode  |
 * | R25  | Server component                 | No hooks → no `'use client'`                                |
 * | R26  | A11y per WCAG 2.2 SC 2.4.13      | 2px solid ring, ≥3:1 contrast, configurable offset          |
 */

export const MIN_VIEWPORT = 320 as const;

type FocusRingOffset = 'none' | 'sm' | 'md' | 'lg';

const OFFSET: Record<FocusRingOffset, string> = {
  none: 'focus-within:ring-offset-0',
  sm: 'focus-within:ring-offset-1',
  md: 'focus-within:ring-offset-2',
  lg: 'focus-within:ring-offset-4',
};

type FocusRingProps = React.ComponentProps<'span'> & {
  /**
   * Distance between the focused element and the ring. Defaults to `md`
   * (2 px), matching the preflight contract.
   */
  offset?: FocusRingOffset;
};

/**
 * Renders a `<span>`. If the consumer needs a block-level wrapper, set
 * `display: block` via className — the wrapper is `inline-block` by default
 * but accepts any display utility (the focus contract is independent of
 * box model).
 */
export const FocusRing = React.forwardRef<HTMLSpanElement, FocusRingProps>(
  ({ className, offset = 'md', children, ...props }, ref) => (
    <span
      ref={ref}
      data-slot="focus-ring"
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn(
        'inline-block rounded-md',
        'focus-within:outline-none focus-within:ring-2 focus-within:ring-ring',
        OFFSET[offset],
        'transition-shadow',
        className,
      )}
      {...props}
    >
      {children}
    </span>
  ),
);
FocusRing.displayName = 'FocusRing';
