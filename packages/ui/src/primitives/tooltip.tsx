'use client';

/**
 * @interlace/ui — Tooltip
 *
 * A short label that appears beside its trigger on hover or on keyboard focus.
 * Wraps @base-ui/react/tooltip and adds the one thing Base UI 1.6 does not
 * emit: the `role="tooltip"` / `aria-describedby` pair.
 *
 * Base UI owns the open/close timing, the positioning and Escape-to-dismiss.
 *
 * That wiring is the reason this file is more than a class list. Without it a
 * tooltip is, to a screen reader, simply not there: the trigger announces its
 * own label and nothing else, and the popup is an unlabelled box in a portal
 * (WCAG 1.3.1 / 4.1.2). The shared id travels through a React context because
 * both ends need the SAME id and neither part can see the other.
 *
 * ## Anatomy
 *
 *   Tooltip                          (TooltipProvider → context → Tooltip.Root)
 *     ├─ TooltipTrigger              (Tooltip.Trigger — carries aria-describedby)
 *     └─ TooltipContent              (Portal → Positioner → Popup — id, role=tooltip)
 *          └─ Tooltip.Arrow
 *
 * ## One consequence of that shape, and how `delay` survives it
 *
 * `Tooltip` mounts its OWN `TooltipProvider`, so every tooltip is its own
 * provider even inside an app-level one — an outer `<TooltipProvider delay=…>`
 * does not govern it. Base UI puts `delay` on the provider and not on
 * `Tooltip.Root`, so the timing would be unreachable from a call site. It is
 * therefore declared on `Tooltip` (and forwarded by `TooltipCompose`) and
 * routed to the provider this file owns. It used to be accepted and dropped on
 * the floor (`void delay`); `primitive-api-contract-lock` hovers a tooltip with
 * a 100s delay and fails if it opens anyway.
 *
 * `aria-describedby` stays on the trigger even while the popup is unmounted.
 * That is deliberate: a dangling reference is ignored by assistive tech,
 * whereas toggling the attribute on open races the announcement.
 *
 * ## MIN_VIEWPORT — 320
 *
 * Unlike HoverCard (768 — hover-only rich content), a tooltip is a short
 * `w-fit` label that Base UI also opens on keyboard focus, so it stays usable
 * on a 320px touch screen. Declared on the popup — `Tooltip.Root` renders no
 * DOM node.
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends Base UI part props       | `React.ComponentProps<typeof BaseTooltip.*>`                |
 * | R6   | data-slot per part               | tooltip / -provider / -trigger / -content                   |
 * | R7   | cn + ...rest                     | `cn('bg-primary …', className)` + `{...props}` on the popup |
 * | R10  | Composition seam                 | `Compose` for trigger+label; the parts for anything richer  |
 * | R12  | Reuse over wrap                  | Base UI owns timing, positioning and dismissal              |
 * | R14  | Declares min viewport            | `data-min-viewport` on the popup + exported const           |
 * | R19  | Tokens only                      | `bg-primary`, `text-primary-foreground`, `fill-primary`     |
 * | R25  | Client component                 | Required — `React.useId` + Base UI client hooks             |
 * | R26  | A11y this file adds              | `id` + `role="tooltip"` on the popup, `aria-describedby` on the trigger |
 */

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

type TooltipProps = React.ComponentProps<typeof BaseTooltip.Root> & {
  /**
   * How long to wait before opening, in ms. Base UI puts `delay` on the
   * PROVIDER, not on `Tooltip.Root` — and because this component mounts its own
   * provider (see the header), the provider a call site could otherwise reach is
   * not the one that governs this tooltip. So the prop is declared here and
   * handed to the provider this file owns. Default 0, matching
   * `TooltipProvider`.
   */
  delay?: number;
  /** How long to wait before closing, in ms. Same routing as `delay`. */
  closeDelay?: number;
};

function Tooltip({ delay, closeDelay, ...props }: TooltipProps) {
  const descriptionId = React.useId();
  return (
    <TooltipProvider delay={delay} closeDelay={closeDelay}>
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
  /** Delay before showing (ms). Defaults to 0, the `TooltipProvider` default. */
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
  return (
    <Tooltip delay={delay}>
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
export type { TooltipComposeProps, TooltipProps };
