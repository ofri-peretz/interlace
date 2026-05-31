'use client';

import * as React from 'react';
import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip';

import { cn } from '../lib/cn.js';

function TooltipProvider({
  delay = 0,
  ...props
}: React.ComponentProps<typeof BaseTooltip.Provider>) {
  return (
    <BaseTooltip.Provider data-slot="tooltip-provider" delay={delay} {...props} />
  );
}

function Tooltip({
  ...props
}: React.ComponentProps<typeof BaseTooltip.Root>) {
  return (
    <TooltipProvider>
      <BaseTooltip.Root data-slot="tooltip" {...props} />
    </TooltipProvider>
  );
}

function TooltipTrigger(
  props: React.ComponentProps<typeof BaseTooltip.Trigger>,
) {
  return <BaseTooltip.Trigger data-slot="tooltip-trigger" {...props} />;
}

function TooltipContent({
  className,
  side,
  sideOffset = 0,
  children,
  ...props
}: React.ComponentProps<typeof BaseTooltip.Popup> & {
  side?: 'top' | 'right' | 'bottom' | 'left' | 'inline-start' | 'inline-end';
  sideOffset?: number;
}) {
  return (
    <BaseTooltip.Portal>
      <BaseTooltip.Positioner side={side} sideOffset={sideOffset}>
        <BaseTooltip.Popup
          data-slot="tooltip-content"
          className={cn(
            'bg-primary text-primary-foreground animate-in fade-in-0 zoom-in-95 data-[closed]:animate-out data-[closed]:fade-out-0 data-[closed]:zoom-out-95 z-50 w-fit origin-(--transform-origin) rounded-md px-3 py-1.5 text-xs text-balance',
            className,
          )}
          {...props}
        >
          {children}
          <BaseTooltip.Arrow className="bg-primary fill-primary z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px]" />
        </BaseTooltip.Popup>
      </BaseTooltip.Positioner>
    </BaseTooltip.Portal>
  );
}

/* ─────────────────────────────────────────────────────────────────
 * TooltipCompose — convenience composition.
 *
 * Renders Root + Trigger + Content for the canonical "hover icon →
 * tooltip with label" pattern. Wrap your app in TooltipProvider once at
 * the top; then `<TooltipCompose>` per icon-only button keeps the rest
 * of the tree clean.
 *
 *   <TooltipCompose
 *     trigger={<IconButton><Search /></IconButton>}
 *     label="Search (⌘K)"
 *   />
 * ──────────────────────────────────────────────────────────────── */
interface TooltipComposeProps {
  trigger: React.ReactNode;
  /** Tooltip text — typically a short label or shortcut hint. */
  label: React.ReactNode;
  /** Floating-UI side. */
  side?: React.ComponentProps<typeof TooltipContent>['side'];
  /** Delay before showing (ms). Defaults to the TooltipProvider default. */
  delay?: number;
  className?: string;
}

function TooltipCompose({
  trigger,
  label,
  side,
  delay,
  className,
}: TooltipComposeProps) {
  // Tooltip Root doesn't accept `delay` directly — it's owned by
  // TooltipProvider higher up. We accept `delay` in this API for
  // forward-compat but don't forward it here.
  void delay;
  return (
    <Tooltip>
      <TooltipTrigger render={trigger as React.ReactElement} />
      <TooltipContent side={side} className={className}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

// Dotted access — `<Tooltip.Compose ...>`. See dialog.tsx for pattern.
const TooltipWithDot = Object.assign(Tooltip, {
  Compose: TooltipCompose,
}) as typeof Tooltip & { Compose: typeof TooltipCompose };

export {
  TooltipWithDot as Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
  TooltipCompose,
};
export type { TooltipComposeProps };
