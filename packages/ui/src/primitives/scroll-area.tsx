// Mirrors the shadcn ScrollArea canon, built on Base UI.
// Upstream: https://base-ui.com/react/components/scroll-area
'use client';

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
