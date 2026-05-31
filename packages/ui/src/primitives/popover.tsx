'use client';

import * as React from 'react';
import { Popover as BasePopover } from '@base-ui/react/popover';

import { cn } from '../lib/cn.js';

function Popover(props: React.ComponentProps<typeof BasePopover.Root>) {
  return <BasePopover.Root data-slot="popover" {...props} />;
}

function PopoverTrigger(
  props: React.ComponentProps<typeof BasePopover.Trigger>,
) {
  return <BasePopover.Trigger data-slot="popover-trigger" {...props} />;
}

function PopoverAnchor(
  props: React.ComponentProps<typeof BasePopover.Trigger>,
) {
  return <BasePopover.Trigger data-slot="popover-anchor" {...props} />;
}

function PopoverContent({
  className,
  side,
  align = 'center',
  sideOffset = 4,
  children,
  ...props
}: React.ComponentProps<typeof BasePopover.Popup> & {
  side?: 'top' | 'right' | 'bottom' | 'left' | 'inline-start' | 'inline-end';
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
}) {
  return (
    <BasePopover.Portal>
      <BasePopover.Positioner side={side} sideOffset={sideOffset} align={align}>
        <BasePopover.Popup
          data-slot="popover-content"
          className={cn(
            'bg-popover text-popover-foreground data-[open]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[open]:fade-in-0 data-[closed]:zoom-out-95 data-[open]:zoom-in-95 z-50 w-72 origin-(--transform-origin) rounded-md border p-4 shadow-md outline-hidden',
            className,
          )}
          {...props}
        >
          {children}
        </BasePopover.Popup>
      </BasePopover.Positioner>
    </BasePopover.Portal>
  );
}

/* ─────────────────────────────────────────────────────────────────
 * PopoverCompose — convenience composition.
 *
 * Wraps Root + Trigger + Content (which already bundles
 * Portal + Positioner + Popup) in a single component for the common case.
 *
 *   <PopoverCompose
 *     trigger={<Button variant="ghost">Filters</Button>}
 *     content={<FilterPanel />}
 *     side="bottom"
 *     align="start"
 *   />
 * ──────────────────────────────────────────────────────────────── */
interface PopoverComposeProps {
  trigger: React.ReactNode;
  content: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Floating-UI side. */
  side?: React.ComponentProps<typeof PopoverContent>['side'];
  /** Floating-UI alignment along the side. */
  align?: React.ComponentProps<typeof PopoverContent>['align'];
  className?: string;
}

function PopoverCompose({
  trigger,
  content,
  open,
  onOpenChange,
  side,
  align,
  className,
}: PopoverComposeProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger render={trigger as React.ReactElement} />
      <PopoverContent side={side} align={align} className={className}>
        {content}
      </PopoverContent>
    </Popover>
  );
}

export {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverAnchor,
  PopoverCompose,
};
export type { PopoverComposeProps };
