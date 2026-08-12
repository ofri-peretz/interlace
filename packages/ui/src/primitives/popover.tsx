'use client';

/**
 * @interlace/ui — Popover
 *
 * A non-modal floating panel anchored to its trigger. It dismisses on Escape
 * and on an outside click and returns focus to the trigger, but it does NOT
 * trap focus or make the page inert.
 *
 * That is the line between this and Dialog/Sheet, and it is the reason to pick
 * one over the other.
 *
 * Wraps @base-ui/react/popover: Base UI owns the open state, the dismissal and
 * focus behaviour above, and the positioner that flips and shifts the panel
 * into the viewport. We own the surface — `w-72`, the popover tokens, the
 * border, the shadow and the open/close animation.
 *
 * ## Anatomy
 *
 *   Popover                          (Popover.Root + the anchor context — no DOM node of its own)
 *     ├─ PopoverTrigger              (Popover.Trigger)
 *     ├─ PopoverAnchor               (an inert div — registers itself as the positioner's anchor)
 *     └─ PopoverContent              (Portal → Positioner → Popup — data-min-viewport=320)
 *
 * Base UI 1.6 ships no `Popover.Anchor` part; the seam is the `anchor` prop on
 * `Popover.Positioner`. `PopoverAnchor` therefore renders an inert element and
 * introduces it to `PopoverContent` through a context, so anchoring the panel
 * to one element while triggering it from another gives you ONE trigger. It
 * previously rendered a second `Popover.Trigger` under a different `data-slot`,
 * which gave you two.
 *
 * `PopoverCompose` (also `Popover.Compose`) is the trigger + content pair in
 * one element for the common case.
 *
 * ## MIN_VIEWPORT — 320
 *
 * The popup is `w-72` (288px), which still clears the 320 floor with gutters,
 * and Base UI's positioner shifts it into view rather than letting it clip.
 * Declared on the popup, because `Popover.Root` renders no DOM node.
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends Base UI part props       | `React.ComponentProps<typeof BasePopover.*>`                |
 * | R6   | data-slot per part               | popover / -trigger / -anchor / -content                     |
 * | R7   | cn + ...rest                     | `cn('bg-popover …', className)` + `{...props}` on the popup |
 * | R10  | Composition seam                 | `Compose` for trigger+content; parts for anything richer; `render` on the anchor |
 * | R12  | Reuse over wrap                  | Base UI owns dismissal, focus return and positioning        |
 * | R14  | Declares min viewport            | `data-min-viewport` on the popup + exported const           |
 * | R19  | Tokens only                      | `bg-popover`, `text-popover-foreground`                     |
 * | R25  | Client component                 | Required — Base UI Popover ships client hooks               |
 * | R26  | Keyboard contract                | Escape-dismissal + focus restore asserted by `Popover.stories.tsx`, locked by `overlay-nav-keyboard-lock` |
 */

import * as React from 'react';
import { Popover as BasePopover } from '@base-ui/react/popover';
import { useRender } from '@base-ui/react/use-render';

import { cn } from '../lib/cn.js';

/**
 * Minimum viable viewport (CSS px) — DESIGN_PRINCIPLES #14. The popup is
 * `w-72` (288px), which still clears the 320 floor with gutters; Base UI's
 * positioner flips/shifts it into the viewport rather than letting it clip.
 * Projected onto the popup — `Popover.Root` renders no DOM node.
 */
export const MIN_VIEWPORT = 320 as const;

/**
 * The element `PopoverContent` positions against, when it is not the trigger.
 *
 * Base UI 1.6 ships no `Popover.Anchor` part — the seam is the `anchor` prop on
 * `Popover.Positioner`, which takes an element (or a ref, or a virtual one).
 * That prop lives on the popup side of the tree and the anchor lives on the
 * trigger side, so the two are introduced through this context. `null` means
 * "no anchor declared", and the positioner falls back to the trigger, which is
 * what it does by default anyway.
 */
const PopoverAnchorContext = React.createContext<{
  anchor: HTMLElement | null;
  setAnchor: (element: HTMLElement | null) => void;
} | null>(null);

function Popover(props: React.ComponentProps<typeof BasePopover.Root>) {
  const [anchor, setAnchor] = React.useState<HTMLElement | null>(null);
  const value = React.useMemo(() => ({ anchor, setAnchor }), [anchor]);
  return (
    <PopoverAnchorContext.Provider value={value}>
      <BasePopover.Root data-slot="popover" {...props} />
    </PopoverAnchorContext.Provider>
  );
}

function PopoverTrigger(
  props: React.ComponentProps<typeof BasePopover.Trigger>,
) {
  return <BasePopover.Trigger data-slot="popover-trigger" {...props} />;
}

type PopoverAnchorProps = React.ComponentProps<'div'> & {
  render?: useRender.RenderProp;
};

/**
 * Anchors the panel to something that is not the trigger — a table row, an
 * input, a caret position.
 *
 * This used to render a SECOND `Popover.Trigger` under a different
 * `data-slot`, so a consumer who anchored to one element and triggered from
 * another shipped two buttons that both opened the panel, both announcing
 * `aria-haspopup` to assistive tech. It now renders an inert element (a `div`
 * by default, or whatever `render` is given) and registers it as the
 * positioner's anchor. `primitive-api-contract-lock` clicks it and fails if the
 * panel opens.
 */
function PopoverAnchor({ render, ...props }: PopoverAnchorProps) {
  const context = React.useContext(PopoverAnchorContext);
  return useRender({
    render: render ?? <div />,
    ref: context?.setAnchor,
    props: {
      'data-slot': 'popover-anchor',
      ...props,
    },
  });
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
  const context = React.useContext(PopoverAnchorContext);
  return (
    <BasePopover.Portal>
      <BasePopover.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        // `undefined` — not `null` — when no `PopoverAnchor` was declared:
        // Base UI reads `undefined` as "fall back to the trigger".
        anchor={context?.anchor ?? undefined}
      >
        <BasePopover.Popup
          data-slot="popover-content"
          data-min-viewport={String(MIN_VIEWPORT)}
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

// Dotted access — `<Popover.Compose ...>`. See dialog.tsx for pattern.
const PopoverWithDot = Object.assign(Popover, {
  Compose: PopoverCompose,
}) as typeof Popover & { Compose: typeof PopoverCompose };

export {
  PopoverWithDot as Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverAnchor,
  PopoverCompose,
};
export type { PopoverAnchorProps, PopoverComposeProps };
