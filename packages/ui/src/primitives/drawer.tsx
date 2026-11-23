// Mirrors the shadcn Drawer canon (Drawer, DrawerTrigger, DrawerContent,
// DrawerHeader, DrawerFooter, DrawerTitle, DrawerDescription, DrawerClose),
// built on Base UI's Drawer instead of vaul.
// Upstream: https://base-ui.com/react/components/drawer
'use client';

/**
 * @interlace/ui — Drawer
 *
 * A panel that slides in from an edge and follows the finger: drag it back
 * toward its edge and it goes, let go early and it settles back. The bottom
 * sheet of a phone app, on the web. Base UI's Drawer owns the gesture, the
 * open state, the focus trap, page inerting, Escape and outside-press
 * dismissal, and snap points; we own the scrim, the surface, the handle and
 * the motion.
 *
 * Reach for `Sheet` when the panel is a desktop side pane that nobody drags,
 * and `Dialog` when the task must be finished before returning. A Drawer is
 * for touch first: a filter panel, a share sheet, an action list, a mobile
 * menu.
 *
 * ## Anatomy
 *
 *   Drawer                           (Drawer.Root — renders no DOM node; `direction`)
 *     ├─ DrawerTrigger               (Drawer.Trigger)
 *     └─ DrawerContent               (Portal → Backdrop → Viewport → Popup)
 *          ├─ handle                 (top or bottom drawers — data-slot="drawer-handle", aria-hidden)
 *          ├─ Drawer.Content         (data-slot="drawer-body" — scrolls; text stays selectable)
 *          │    ├─ DrawerHeader → DrawerTitle + DrawerDescription
 *          │    ├─ children
 *          │    └─ DrawerFooter      (mt-auto)
 *          └─ a Drawer.Close "X"     (always rendered, sr-only label "Close")
 *
 * `DrawerContent` mounts its own portal, scrim and viewport, as `SheetContent`
 * does, so a call site never stacks two scrims.
 *
 * ## Gesture and motion
 *
 * `direction` (bottom by default) picks the edge and the swipe that dismisses.
 * While a finger drags, Base UI writes `--drawer-swipe-movement-x/y` and the
 * popup follows it with no transition; the scrim fades by
 * `--drawer-swipe-progress`. On release the popup springs back or leaves, and
 * a fast flick leaves faster (`--drawer-swipe-strength` scales the exit).
 * Overshoot toward the open side shows a `bleed` of the same surface instead
 * of a gap. Snap points (`snapPoints` on the root) move the resting height
 * through `--drawer-snap-point-offset` (bottom drawers only), and the body pads by the same amount
 * so its last line stays reachable.
 *
 * Under `prefers-reduced-motion: reduce` the open and close slides are
 * instant. Dragging still moves the panel: the reader is the motion, as with
 * a scrollbar.
 *
 * ## Safe areas
 *
 * A bottom drawer pads its body by `env(safe-area-inset-bottom)`, so the last
 * action clears the home indicator on a phone with `viewport-fit=cover`.
 *
 * ## MIN_VIEWPORT — 320
 *
 * Side drawers are `w-3/4` (240px at the floor) capped at `xs:max-w-96`;
 * top and bottom drawers are full width and at most the viewport height less
 * 2rem, so the page stays visible above and a tap there closes it.
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends Base UI part props       | `React.ComponentProps<typeof BaseDrawer.*>`                 |
 * | R6   | data-slot per part               | drawer-trigger / -close / -portal / -overlay / -viewport / -content / -handle / -body / -header / -footer / -title / -description / -close-x |
 * | R7   | cn + ...rest                     | `cn(…, className)` + `{...props}`                           |
 * | R8   | Enum for edge                    | `direction = top | right | bottom | left` (default bottom)  |
 * | R12  | Reuse over wrap                  | Base UI Drawer owns the gesture, focus trap and dismissal   |
 * | R14  | Declares min viewport            | `data-min-viewport` on the popup + exported const           |
 * | R19  | Tokens only                      | `bg-background`, `bg-muted-foreground/40` handle, motion tokens (the scrim excepted, as in Sheet) |
 * | R25  | Client component                 | Required — Base UI Drawer ships client hooks                |
 * | R26  | Keyboard contract                | Escape-dismissal + focus restore asserted by `Drawer.stories.tsx`, locked by `overlay-nav-keyboard-lock` |
 */

import * as React from 'react';
import { Drawer as BaseDrawer } from '@base-ui/react/drawer';
import { XIcon } from 'lucide-react';

import { cn } from '../lib/cn.js';

/**
 * Minimum viable viewport (CSS px) — DESIGN_PRINCIPLES #14. Side drawers are
 * `w-3/4` (240px at the 320 floor); top and bottom drawers are full width.
 * Projected onto the popup, because `Drawer.Root` renders no DOM node.
 */
export const MIN_VIEWPORT = 320 as const;

type DrawerDirection = 'top' | 'right' | 'bottom' | 'left';

/** The swipe that dismisses a drawer is toward its own edge. */
const SWIPE = { top: 'up', right: 'right', bottom: 'down', left: 'left' } as const;

const DirectionContext = React.createContext<DrawerDirection>('bottom');

type DrawerProps = Omit<React.ComponentProps<typeof BaseDrawer.Root>, 'swipeDirection'> & {
  /** The edge the drawer is attached to; dragging toward it dismisses. @default 'bottom' */
  direction?: DrawerDirection;
  /** Heights a bottom drawer rests at (fractions of the viewport, px, or rem strings). Bottom drawers only: other directions ignore it. */
  snapPoints?: React.ComponentProps<typeof BaseDrawer.Root>['snapPoints'];
};

function Drawer({ direction = 'bottom', ...props }: DrawerProps) {
  return (
    <DirectionContext.Provider value={direction}>
      <BaseDrawer.Root swipeDirection={SWIPE[direction]} {...props} />
    </DirectionContext.Provider>
  );
}

function DrawerTrigger(props: React.ComponentProps<typeof BaseDrawer.Trigger>) {
  return <BaseDrawer.Trigger data-slot="drawer-trigger" {...props} />;
}

function DrawerClose(props: React.ComponentProps<typeof BaseDrawer.Close>) {
  return <BaseDrawer.Close data-slot="drawer-close" {...props} />;
}

function DrawerPortal(props: React.ComponentProps<typeof BaseDrawer.Portal>) {
  return <BaseDrawer.Portal data-slot="drawer-portal" {...props} />;
}

function DrawerOverlay({
  className,
  ...props
}: React.ComponentProps<typeof BaseDrawer.Backdrop>) {
  return (
    <BaseDrawer.Backdrop
      data-slot="drawer-overlay"
      className={cn(
        // `bg-black/50` is the deliberate scrim colour, as in Sheet: a
        // theme-paired token would invert in dark mode and light the page.
        // It thins as the panel is dragged away, and follows the finger
        // with no transition while it does.
        'fixed inset-0 z-50 min-h-dvh bg-black/50 opacity-[calc(1-var(--drawer-swipe-progress,0))]',
        'ease-enter transition-opacity duration-(--duration-slow) motion-reduce:transition-none',
        'data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 data-[swiping]:duration-0',
        'data-[ending-style]:ease-exit data-[ending-style]:duration-[calc(var(--drawer-swipe-strength,1)*var(--duration-medium))]',
        className,
      )}
      {...props}
    />
  );
}

/** Where the viewport puts the panel, per edge. */
const VIEWPORT: Record<DrawerDirection, string> = {
  bottom: 'items-end justify-center',
  top: 'items-start justify-center',
  right: 'items-stretch justify-end',
  left: 'items-stretch justify-start',
};

/**
 * The panel per edge: its size, its border, where it rests (following the
 * finger and the snap offset), where it enters from and leaves to, and the
 * bleed that fills the gap when it is pulled past open. One static string per
 * edge so Tailwind can scan them.
 */
const POPUP: Record<DrawerDirection, string> = {
  bottom: cn(
    'max-h-[calc(100dvh-2rem)] w-full rounded-t-xl border-t touch-none',
    '[transform:translateY(calc(var(--drawer-snap-point-offset,0px)+var(--drawer-swipe-movement-y,0px)))]',
    'data-[starting-style]:[transform:translateY(100%)] data-[ending-style]:[transform:translateY(100%)]',
    "after:absolute after:inset-x-0 after:top-full after:h-12 after:bg-inherit after:content-['']",
  ),
  top: cn(
    'max-h-[calc(100dvh-2rem)] w-full rounded-b-xl border-b touch-none',
    '[transform:translateY(var(--drawer-swipe-movement-y,0px))]',
    'data-[starting-style]:[transform:translateY(-100%)] data-[ending-style]:[transform:translateY(-100%)]',
    "after:absolute after:inset-x-0 after:bottom-full after:h-12 after:bg-inherit after:content-['']",
  ),
  right: cn(
    'h-full w-3/4 border-l xs:max-w-96',
    '[transform:translateX(var(--drawer-swipe-movement-x,0px))]',
    'data-[starting-style]:[transform:translateX(100%)] data-[ending-style]:[transform:translateX(100%)]',
    "after:absolute after:inset-y-0 after:left-full after:w-12 after:bg-inherit after:content-['']",
  ),
  left: cn(
    'h-full w-3/4 border-r xs:max-w-96',
    '[transform:translateX(var(--drawer-swipe-movement-x,0px))]',
    'data-[starting-style]:[transform:translateX(-100%)] data-[ending-style]:[transform:translateX(-100%)]',
    "after:absolute after:inset-y-0 after:right-full after:w-12 after:bg-inherit after:content-['']",
  ),
};

/**
 * The body pads its far edge so a snapped or bottom drawer's last line stays reachable.
 * `--drawer-snap-point-offset` is the positive distance the panel sits below full height, and
 * `--drawer-swipe-movement-y` is the live drag (down is positive), so their sum is the height
 * currently off-screen. `max(0px, …)` stops an upward over-drag from going negative.
 */
const BODY: Record<DrawerDirection, string> = {
  bottom:
    'pb-[calc(env(safe-area-inset-bottom,0px)+max(0px,var(--drawer-snap-point-offset,0px)+var(--drawer-swipe-movement-y,0px)))]',
  top: '',
  right: '',
  left: '',
};

function DrawerHandle({ className }: { className?: string }) {
  return (
    <div
      data-slot="drawer-handle"
      aria-hidden
      className={cn('bg-muted-foreground/40 mx-auto h-1.5 w-12 shrink-0 rounded-full', className)}
    />
  );
}

type DrawerContentProps = React.ComponentProps<typeof BaseDrawer.Popup>;

function DrawerContent({ className, children, ...props }: DrawerContentProps) {
  const direction = React.useContext(DirectionContext);
  const vertical = direction === 'top' || direction === 'bottom';
  return (
    <DrawerPortal>
      <DrawerOverlay />
      <BaseDrawer.Viewport
        data-slot="drawer-viewport"
        className={cn('fixed inset-0 z-50 flex', VIEWPORT[direction])}
      >
        <BaseDrawer.Popup
          data-slot="drawer-content"
          data-direction={direction}
          data-min-viewport={String(MIN_VIEWPORT)}
          className={cn(
            'bg-background text-foreground relative flex min-h-0 flex-col shadow-lg outline-none',
            // Opening takes the slow band and leaves in the medium one, faster
            // still after a flick. While a finger drags, no transition: the
            // panel is wherever the finger is.
            'ease-enter transition-transform duration-(--duration-slow) motion-reduce:transition-none',
            'data-[swiping]:duration-0 data-[swiping]:select-none',
            'data-[ending-style]:ease-exit data-[ending-style]:duration-[calc(var(--drawer-swipe-strength,1)*var(--duration-medium))]',
            POPUP[direction],
            className,
          )}
          {...props}
        >
          {direction === 'bottom' ? <DrawerHandle className="mt-3" /> : null}
          {/* The body is the scroller, so it takes focus: with only text
              inside, arrow keys and Page Down could not reach a long body
              otherwise (axe `scrollable-region-focusable`). */}
          <BaseDrawer.Content
            data-slot="drawer-body"
            tabIndex={0}
            className={cn(
              'flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain',
              'focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px] focus-visible:ring-inset',
              vertical && 'touch-auto',
              BODY[direction],
            )}
          >
            {children}
          </BaseDrawer.Content>
          {direction === 'top' ? <DrawerHandle className="mb-3" /> : null}
          <BaseDrawer.Close
            data-slot="drawer-close-x"
            className="ring-offset-background focus-visible:ring-ring absolute top-4 end-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-[3px] focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:pointer-events-none"
          >
            <XIcon className="size-4" />
            <span className="sr-only">Close</span>
          </BaseDrawer.Close>
        </BaseDrawer.Popup>
      </BaseDrawer.Viewport>
    </DrawerPortal>
  );
}

function DrawerHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="drawer-header"
      className={cn('flex flex-col gap-1.5 p-4 pe-12', className)}
      {...props}
    />
  );
}

function DrawerFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="drawer-footer"
      className={cn('mt-auto flex flex-col gap-2 p-4', className)}
      {...props}
    />
  );
}

function DrawerTitle({ className, ...props }: React.ComponentProps<typeof BaseDrawer.Title>) {
  return (
    <BaseDrawer.Title
      data-slot="drawer-title"
      className={cn('text-foreground font-semibold', className)}
      {...props}
    />
  );
}

function DrawerDescription({
  className,
  ...props
}: React.ComponentProps<typeof BaseDrawer.Description>) {
  return (
    <BaseDrawer.Description
      data-slot="drawer-description"
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  );
}

export {
  Drawer,
  DrawerTrigger,
  DrawerClose,
  DrawerPortal,
  DrawerOverlay,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
};
export type { DrawerProps, DrawerContentProps, DrawerDirection };
