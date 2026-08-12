// Mirrors the shadcn ScrollArea canon, built on Base UI.
// Upstream: https://base-ui.com/react/components/scroll-area
'use client';

/**
 * @interlace/ui — ScrollArea
 *
 * A scrollable region with a styled overlay scrollbar in place of the platform
 * one. Wraps @base-ui/react/scroll-area: Base UI owns overflow detection and
 * thumb geometry; we own the track, the thumb colour and the focus ring.
 *
 * The root renders a VERTICAL scrollbar only. `ScrollBar` is exported and
 * takes `orientation="horizontal"`, but a horizontally scrolling area has to
 * be composed from the Base UI parts — `<ScrollArea>` will not grow one.
 *
 * The root is size-agnostic (`relative`, nothing else): it scrolls when its
 * PARENT constrains it. Dropped into an unconstrained column it simply grows.
 *
 * ## Anatomy
 *
 *   ScrollArea                       (ScrollArea.Root — relative, data-min-viewport=320)
 *     ├─ ScrollArea.Viewport         (focus ring lives here — the scrollable box)
 *     │    └─ ScrollArea.Content     (children)
 *     ├─ ScrollBar                   (Scrollbar → Thumb — vertical by default)
 *     └─ ScrollArea.Corner
 *
 * ## MIN_VIEWPORT — 320
 *
 * The root is sized by its parent and the scrollbar track is an overlay
 * (`p-px` + `w-2.5`, positioned by Base UI), so it costs no horizontal layout
 * space at the 320 floor.
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends Base UI part props       | `React.ComponentProps<typeof BaseScrollArea.Root/Scrollbar>` |
 * | R6   | data-slot per part               | scroll-area / -viewport / -scrollbar / -thumb               |
 * | R7   | cn + ...rest                     | `cn('relative', className)` + `{...props}`                  |
 * | R8   | Enum for axis                    | `orientation = horizontal | vertical` on `ScrollBar`        |
 * | R12  | Reuse over wrap                  | Base UI owns overflow detection and thumb geometry          |
 * | R14  | Declares min viewport            | `data-min-viewport={String(MIN_VIEWPORT)}` + exported const |
 * | R19  | Tokens only                      | `bg-border` thumb, `ring-ring/50` viewport ring             |
 * | R25  | Client component                 | Required — Base UI ScrollArea ships client hooks            |
 * | R26  | A11y                             | the VIEWPORT takes focus and shows a ring, so a scrollable region is keyboard-reachable (axe `scrollable-region-focusable`); arrow-key scrolling is asserted by `ScrollArea.stories.tsx` |
 */

import * as React from 'react';
import { ScrollArea as BaseScrollArea } from '@base-ui/react/scroll-area';

import { cn } from '../lib/cn.js';

/**
 * Minimum viable viewport (CSS px) — DESIGN_PRINCIPLES #14. The root is
 * size-agnostic (`relative`, sized by its parent) and the 10px scrollbar
 * track is an overlay, so it costs no horizontal space at the 320 floor.
 */
export const MIN_VIEWPORT = 320 as const;

function ScrollArea({
  className,
  children,
  ...props
}: React.ComponentProps<typeof BaseScrollArea.Root>) {
  return (
    <BaseScrollArea.Root
      data-slot="scroll-area"
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn('relative', className)}
      {...props}
    >
      <BaseScrollArea.Viewport
        data-slot="scroll-area-viewport"
        className="focus-visible:ring-ring/50 size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:outline-1"
      >
        <BaseScrollArea.Content>{children}</BaseScrollArea.Content>
      </BaseScrollArea.Viewport>
      <ScrollBar />
      <BaseScrollArea.Corner />
    </BaseScrollArea.Root>
  );
}

function ScrollBar({
  className,
  orientation = 'vertical',
  ...props
}: React.ComponentProps<typeof BaseScrollArea.Scrollbar> & {
  orientation?: 'horizontal' | 'vertical';
}) {
  return (
    <BaseScrollArea.Scrollbar
      data-slot="scroll-area-scrollbar"
      orientation={orientation}
      className={cn(
        'flex touch-none p-px transition-colors select-none',
        orientation === 'vertical' &&
          'h-full w-2.5 border-l border-l-transparent',
        orientation === 'horizontal' &&
          'h-2.5 flex-col border-t border-t-transparent',
        className,
      )}
      {...props}
    >
      <BaseScrollArea.Thumb
        data-slot="scroll-area-thumb"
        className="bg-border relative flex-1 rounded-full"
      />
    </BaseScrollArea.Scrollbar>
  );
}

export { ScrollArea, ScrollBar };
