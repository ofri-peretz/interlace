/**
 * @interlace/ui — Separator
 *
 * A one-pixel rule between blocks of content, horizontal or vertical. Wraps
 * @base-ui/react/separator, which owns the `role` and `aria-orientation`
 * semantics; this file owns exactly two things — the `bg-border` colour and
 * the axis geometry.
 *
 * The vertical form is `h-full w-px`, so it only draws inside a parent with a
 * resolved height (a flex row, a fixed-height toolbar). In a plain block
 * container it has nothing to be the full height OF and renders invisible.
 *
 * ## Anatomy
 *
 *   Separator                        (Base UI Separator — a div)
 *
 * One part, no children, no slots. `orientation` defaults to `horizontal` and
 * is forwarded to Base UI as well as switching the geometry, so the visual
 * axis and the announced one cannot disagree.
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends Base UI part props       | `React.ComponentProps<typeof BaseSeparator>`                |
 * | R6   | data-slot on root                | `data-slot="separator"`                                     |
 * | R7   | cn + ...rest                     | `cn('bg-border shrink-0', …, className)` + `{...props}`     |
 * | R8   | Enum for axis                    | `orientation = horizontal | vertical`                       |
 * | R12  | Reuse over wrap                  | Base UI owns the separator role + aria-orientation          |
 * | R19  | Tokens only                      | `bg-border`                                                 |
 * | R25  | Server component                 | No hooks → no `'use client'`                                |
 *
 * No `MIN_VIEWPORT`: a rule has no intrinsic width of its own to defend — it
 * takes the measure of whatever contains it.
 */

import * as React from 'react';
import { Separator as BaseSeparator } from '@base-ui/react/separator';

import { cn } from '../lib/cn.js';

type SeparatorProps = React.ComponentProps<typeof BaseSeparator> & {
  orientation?: 'horizontal' | 'vertical';
};

function Separator({
  className,
  orientation = 'horizontal',
  ...props
}: SeparatorProps) {
  return (
    <BaseSeparator
      data-slot="separator"
      orientation={orientation}
      className={cn(
        'bg-border shrink-0',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        className,
      )}
      {...props}
    />
  );
}

export { Separator };
export type { SeparatorProps };
