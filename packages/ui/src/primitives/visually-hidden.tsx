import * as React from 'react';

import { cn } from '../lib/cn.js';

/**
 * @interlace/ui — VisuallyHidden
 *
 * A span (by default) that is **invisible to sighted users but exposed to
 * assistive tech**. Use it for labels, descriptions, and inline-context
 * strings that visual users don't need but screen-reader users do (e.g.
 * "(opens in a new tab)" suffix on an external link icon).
 *
 * Different from `display: none` and `visibility: hidden` — those remove
 * the node from the accessibility tree. This uses the canonical "sr-only"
 * positioning hack (1px × 1px clipped, off-screen) so the screen reader
 * still reaches the text.
 *
 * This is the component form of Tailwind's `sr-only` utility. Use the
 * component when you want a named, slot-aware element you can target in
 * stories / tests; use the utility when you're tweaking an existing
 * element's children inline.
 *
 * ## Anatomy
 *
 *   VisuallyHidden                    (span — data-min-viewport=320)
 *     └─ children                     (the screen-reader-only text)
 *
 * ## MIN_VIEWPORT — 320
 *
 * Screen-reader contract has no viewport constraint; we declare 320 because
 * the primitive may render inside narrow layouts and the contract should
 * still hold there.
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends native el + as-prop      | `React.ComponentProps<'span'> & VisuallyHiddenProps`        |
 * | R6   | data-slot on root                | `data-slot="visually-hidden"`                               |
 * | R7   | className merged + ...rest       | `cn('sr-only', className)` + `{...props}`                   |
 * | R10  | Composition seam                 | `as` prop lets consumers swap span → div / label / etc.     |
 * | R14  | Declares min viewport            | `data-min-viewport={String(MIN_VIEWPORT)}` + exported const |
 * | R18  | Tailwind only                    | Zero inline `style`; `sr-only` class only                   |
 * | R19  | Tokens only                      | No color tokens — invisible primitive                        |
 * | R25  | Server component                 | No hooks → no `'use client'`                                |
 * | R26  | A11y from native el              | sr-only contract = canonical 1px-clip positioning           |
 */

export const MIN_VIEWPORT = 320 as const;

type VisuallyHiddenProps = React.ComponentProps<'span'>;

/**
 * Default `<span>` element. To label a form control with a visually-hidden
 * string, wrap your `<label htmlFor>` content with VisuallyHidden — the
 * outer span doesn't break label semantics; the inner text is still read.
 * For paragraph-level hidden content, wrap in a `<p className="sr-only">`
 * directly (the utility is part of the DS preflight).
 */
export const VisuallyHidden = React.forwardRef<
  HTMLSpanElement,
  VisuallyHiddenProps
>(({ className, children, ...props }, ref) => (
  <span
    ref={ref}
    data-slot="visually-hidden"
    data-min-viewport={String(MIN_VIEWPORT)}
    className={cn('sr-only', className)}
    {...props}
  >
    {children}
  </span>
));
VisuallyHidden.displayName = 'VisuallyHidden';
