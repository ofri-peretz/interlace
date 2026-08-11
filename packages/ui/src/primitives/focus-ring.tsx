/**
 * @interlace/ui — FocusRing
 *
 * A `<span>` that paints the DS focus ring when anything inside it takes
 * focus — `focus-within` on the wrapper, not `focus-visible` on the child.
 *
 * Reach for it when composing a custom interactive surface (a card-as-button,
 * a clickable row), or in a subtree that opted out of the global ring.
 *
 * Two consequences of putting the ring on a wrapper. It works even when the
 * child sets its own outline, which is the point. And it is `focus-within`,
 * not `focus-visible`: a MOUSE click that lands focus inside will paint the
 * ring too, where the global preflight contract would not have.
 *
 * It renders one real DOM node per wrapped surface — a `<span>`, always. There
 * is no `as` prop and the span is not optional; measure before wrapping
 * thousands of rows.
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
 * | R10  | Composition seam                 | `className` (the wrapper's display is the caller's call)    |
 * | R14  | Declares min viewport            | `data-min-viewport={String(MIN_VIEWPORT)}` + exported const |
 * | R18  | Tailwind only                    | Zero inline `style`; utility classes only                   |
 * | R19  | Tokens only                      | `--ring` semantic token                                     |
 * | R20  | AA contrast                      | `--ring` is contrast-tuned by interlace-theme.css per mode  |
 * | R25  | Server component                 | No hooks → no `'use client'`                                |
 * | R26  | A11y per WCAG 2.2 SC 2.4.13      | 2px solid ring, ≥3:1 contrast, configurable offset          |
 */

import * as React from 'react';

import { cn } from '../lib/cn.js';

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
 * Renders a `<span>`, `inline-block` by default.
 *
 * **Wrapping a block-level child? Pass `className="block"`.** This is not a
 * style preference — an `inline-block` box in normal flow whose child is a
 * `display: block` element with `width: auto` is a circular width dependency,
 * and Chrome resolves it to **zero**: the wrapper measures 0px, the child
 * overflows it, and the content renders one word per line. That shipped as
 * this component's live preview on the public registry.
 *
 * There is deliberately no `as` prop. The contract table used to claim one and
 * none was ever implemented, so `as="div"` landed in `...props` and was written
 * onto the span as an invalid DOM attribute. Per CONVENTIONS.md the DS
 * composition seam is Base UI's `render` prop, not `as`.
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
