'use client';

import * as React from 'react';
import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip';

import { cn } from '../lib/cn.js';

/**
 * Minimum viable viewport (CSS px) — DESIGN_PRINCIPLES #14. Unlike HoverCard
 * (768 — hover-only rich content), a tooltip is a short `w-fit` label that
 * Base UI also opens on keyboard focus, so it stays usable on a 320px touch
 * screen. Projected onto the popup — `Tooltip.Root` renders no DOM node.
 */
export const MIN_VIEWPORT = 320 as const;

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
  const descriptionId = React.useId();
  return (
    <TooltipProvider>
      <TooltipDescriptionContext.Provider value={descriptionId}>
        <BaseTooltip.Root data-slot="tooltip" {...props} />
      </TooltipDescriptionContext.Provider>
    </TooltipProvider>
  );
}

/**
 * Shared id linking the trigger to its popup.
 *
 * Base UI 1.6 emits neither `role="tooltip"` on the popup nor
 * `aria-describedby` on the trigger — the string `aria-describedby` does not
 * appear anywhere in `@base-ui/react/tooltip`. So a tooltip was, to a screen
 * reader, simply not there: the trigger announced its own label and nothing
 * else, and the popup was an unlabelled box in a portal. WCAG 1.3.1 / 4.1.2.
 *
 * The wiring has to live here rather than in either part alone, because the id
 * has to be the SAME on both ends and neither part can see the other.
 *
 * `aria-describedby` stays on the trigger even while the popup is unmounted.
 * That is deliberate and is what Radix does too: a dangling reference is
 * ignored by assistive tech, whereas toggling the attribute on open races the
 * announcement and often loses.
 */
const TooltipDescriptionContext = React.createContext<string | undefined>(undefined);

function TooltipTrigger(
  props: React.ComponentProps<typeof BaseTooltip.Trigger>,
) {
  const describedBy = React.useContext(TooltipDescriptionContext);
  return (
    <BaseTooltip.Trigger
      data-slot="tooltip-trigger"
      aria-describedby={describedBy}
      {...props}
    />
  );
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
  const describedById = React.useContext(TooltipDescriptionContext);
  return (
    <BaseTooltip.Portal>
      <BaseTooltip.Positioner side={side} sideOffset={sideOffset}>
        <BaseTooltip.Popup
          data-slot="tooltip-content"
          data-min-viewport={String(MIN_VIEWPORT)}
          id={describedById}
          role="tooltip"
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
