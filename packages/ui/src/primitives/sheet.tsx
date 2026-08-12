// Mirrors the shadcn Sheet canon — Dialog with side-anchored variants.
// Built on Base UI's Dialog primitives.
// Upstream: https://base-ui.com/react/components/dialog
'use client';

/**
 * @interlace/ui — Sheet
 *
 * A modal panel anchored to one edge of the viewport — a nav drawer, a filter
 * panel, a settings pane. Base UI's Dialog owns the open state, the focus
 * trap, page inerting, Escape and outside-press dismissal; we own the scrim,
 * the slide and the side geometry.
 *
 * Reach for `Dialog` when the task must be finished before returning, and
 * `Popover` when the content is a short aside anchored to a control.
 *
 * ## Anatomy
 *
 *   Sheet                            (Dialog.Root — renders no DOM node)
 *     ├─ SheetTrigger                (Dialog.Trigger)
 *     └─ SheetPortal                 (Dialog.Portal)
 *          ├─ SheetOverlay           (Dialog.Backdrop — fixed, bg-black/50)
 *          └─ SheetContent           (Dialog.Popup — data-side, data-min-viewport=320)
 *               ├─ SheetHeader → SheetTitle + SheetDescription
 *               ├─ children
 *               ├─ SheetFooter       (mt-auto)
 *               └─ a Dialog.Close "X" (always rendered, sr-only label "Close")
 *
 * `SheetContent` mounts its own `SheetPortal` and `SheetOverlay`, so neither is
 * needed at a call site — nesting one inside a hand-written `SheetPortal` +
 * `SheetOverlay` stacks two `bg-black/50` scrims and dims the page to 75%
 * instead of 50%. `SheetCompose` therefore renders `SheetContent` alone, and
 * `primitive-api-contract-lock` counts the backdrops to keep it that way.
 *
 * Every prop this file does not name rides through to `Dialog.Root`, including
 * Base UI's `modal` — pass `modal={false}` for a drawer that leaves the page
 * interactive, and the focus trap and inerting go with it.
 *
 * `bg-black/50` on the scrim is deliberate and NOT a theme token: a paired
 * token would invert in dark mode and light the page up behind the panel.
 *
 * ## MIN_VIEWPORT — 320
 *
 * Left/right sheets are `w-3/4` (240px at the floor) capped at `sm:max-w-96`,
 * and top/bottom are `h-auto`, so nothing clips at the iPhone SE width.
 * Declared on the popup, because `Dialog.Root` renders no DOM node.
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends Base UI part props       | `React.ComponentProps<typeof BaseDialog.*>`                 |
 * | R6   | data-slot per part               | sheet / -trigger / -close / -portal / -overlay / -content / -header / -footer / -title / -description / -close-x |
 * | R7   | cn + ...rest                     | `cn('bg-background …', side && …, className)` + `{...props}` |
 * | R8   | Enum for edge                    | `side = top | right | bottom | left` (default right)        |
 * | R10  | Composition seam                 | `Compose` for the standard tree; the parts for the rest     |
 * | R12  | Reuse over wrap                  | Base UI Dialog owns focus trap, inerting and dismissal      |
 * | R14  | Declares min viewport            | `data-min-viewport` on the popup + exported const           |
 * | R19  | Tokens only                      | `bg-background`, `text-muted-foreground` (the scrim excepted, above) |
 * | R25  | Client component                 | Required — Base UI Dialog ships client hooks                |
 * | R26  | Keyboard contract                | Escape-dismissal + focus restore asserted by `Sheet.stories.tsx`, locked by `overlay-nav-keyboard-lock` |
 */

import * as React from 'react';
import { Dialog as BaseDialog } from '@base-ui/react/dialog';
import { XIcon } from 'lucide-react';

import { cn } from '../lib/cn.js';

/**
 * Minimum viable viewport (CSS px) — DESIGN_PRINCIPLES #14. Left/right sheets
 * are `w-3/4` (240px at the 320 floor) and top/bottom are `h-auto`, so nothing
 * clips at the iPhone SE width. Projected onto the popup — Base UI's
 * `Dialog.Root` renders no DOM node of its own.
 */
export const MIN_VIEWPORT = 320 as const;

function Sheet(props: React.ComponentProps<typeof BaseDialog.Root>) {
  return <BaseDialog.Root data-slot="sheet" {...props} />;
}

function SheetTrigger(
  props: React.ComponentProps<typeof BaseDialog.Trigger>,
) {
  return <BaseDialog.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose(props: React.ComponentProps<typeof BaseDialog.Close>) {
  return <BaseDialog.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal(props: React.ComponentProps<typeof BaseDialog.Portal>) {
  return <BaseDialog.Portal data-slot="sheet-portal" {...props} />;
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof BaseDialog.Backdrop>) {
  return (
    <BaseDialog.Backdrop
      data-slot="sheet-overlay"
      className={cn(
        // See dialog.tsx — `bg-black/50` is the deliberate scrim colour; a
        // theme-paired token would invert in dark mode.
        'data-[open]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[open]:fade-in-0 fixed inset-0 z-50 bg-black/50',
        className,
      )}
      {...props}
    />
  );
}

type SheetContentProps = React.ComponentProps<typeof BaseDialog.Popup> & {
  side?: 'top' | 'right' | 'bottom' | 'left';
};

function SheetContent({
  className,
  children,
  side = 'right',
  ...props
}: SheetContentProps) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <BaseDialog.Popup
        data-slot="sheet-content"
        data-side={side}
        data-min-viewport={String(MIN_VIEWPORT)}
        className={cn(
          'bg-background data-[open]:animate-in data-[closed]:animate-out fixed z-50 flex flex-col gap-4 shadow-lg transition ease-in-out data-[closed]:duration-300 data-[open]:duration-500',
          side === 'right' &&
            'data-[closed]:slide-out-to-right data-[open]:slide-in-from-right inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-96',
          side === 'left' &&
            'data-[closed]:slide-out-to-left data-[open]:slide-in-from-left inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-96',
          side === 'top' &&
            'data-[closed]:slide-out-to-top data-[open]:slide-in-from-top inset-x-0 top-0 h-auto border-b',
          side === 'bottom' &&
            'data-[closed]:slide-out-to-bottom data-[open]:slide-in-from-bottom inset-x-0 bottom-0 h-auto border-t',
          className,
        )}
        {...props}
      >
        {children}
        <BaseDialog.Close
          data-slot="sheet-close-x"
          className="ring-offset-background focus-visible:ring-ring data-[open]:bg-secondary absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-[3px] focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:pointer-events-none"
        >
          <XIcon className="size-4" />
          <span className="sr-only">Close</span>
        </BaseDialog.Close>
      </BaseDialog.Popup>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-header"
      className={cn('flex flex-col gap-1.5 p-4', className)}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn('mt-auto flex flex-col gap-2 p-4', className)}
      {...props}
    />
  );
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof BaseDialog.Title>) {
  return (
    <BaseDialog.Title
      data-slot="sheet-title"
      className={cn('text-foreground font-semibold', className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof BaseDialog.Description>) {
  return (
    <BaseDialog.Description
      data-slot="sheet-description"
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  );
}

/* ─────────────────────────────────────────────────────────────────
 * SheetCompose — convenience composition.
 *
 * Renders the canonical Root → Trigger → Content tree — `SheetContent`
 * supplies the Portal and the Overlay — with a title + body + optional
 * footer for the side-drawer pattern (nav drawers, filter panels,
 * settings).
 *
 *   <SheetCompose
 *     trigger={<Button variant="ghost">Filters</Button>}
 *     side="right"
 *     title="Filter results"
 *     footer={<Button>Apply</Button>}
 *   >
 *     <FilterForm />
 *   </SheetCompose>
 * ──────────────────────────────────────────────────────────────── */
interface SheetComposeProps {
  trigger: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
}

function SheetCompose({
  trigger,
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  side = 'right',
  className,
}: SheetComposeProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger render={trigger as React.ReactElement} />
      {/*
       * No `SheetPortal` / `SheetOverlay` here — `SheetContent` mounts both
       * itself. Wrapping them again stacked two `bg-black/50` scrims, so a
       * composed sheet dimmed the page to 75% black while a hand-composed one
       * dimmed it to 50%: one component, two appearances, decided by which
       * entry point the caller happened to use. Locked by
       * `primitive-api-contract-lock`.
       */}
      <SheetContent side={side} className={className}>
        {(title || description) && (
          <SheetHeader>
            {title ? <SheetTitle>{title}</SheetTitle> : null}
            {description ? (
              <SheetDescription>{description}</SheetDescription>
            ) : null}
          </SheetHeader>
        )}
        {children}
        {footer ? <SheetFooter>{footer}</SheetFooter> : null}
      </SheetContent>
    </Sheet>
  );
}

// Dotted access — `<Sheet.Compose ...>`. See dialog.tsx for pattern.
const SheetWithDot = Object.assign(Sheet, {
  Compose: SheetCompose,
}) as typeof Sheet & { Compose: typeof SheetCompose };

export {
  SheetWithDot as Sheet,
  SheetTrigger,
  SheetClose,
  SheetPortal,
  SheetOverlay,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
  SheetCompose,
};
export type { SheetContentProps, SheetComposeProps };
