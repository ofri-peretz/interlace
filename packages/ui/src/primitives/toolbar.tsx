// Built on Base UI's Toolbar. shadcn has no toolbar; the part names follow
// Base UI's (Toolbar, ToolbarButton, ToolbarLink, ToolbarGroup,
// ToolbarSeparator, ToolbarInput).
// Upstream: https://base-ui.com/react/components/toolbar
'use client';

/**
 * @interlace/ui — Toolbar
 *
 * A row of controls that acts as ONE stop in the Tab order: Tab enters the
 * toolbar on its last-focused control and leaves it on the next Tab, and the
 * arrow keys move between the controls inside, Home and End jump to the ends,
 * and focus wraps. A formatting bar, a table's bulk actions, a player's
 * transport. Without it, a ten-button bar costs a keyboard user ten Tabs to
 * get past.
 *
 * Base UI owns the roving focus (the arrows; this file adds Home and End),
 * the orientation, and keeping a disabled
 * button focusable (so it can still be found and its tooltip read). We own
 * the surface, and the buttons take Button's own variants and sizes, so a
 * toolbar button is a Button that knows it lives in a toolbar.
 *
 * Any Base UI trigger joins the roving focus through `render`:
 * `<ToolbarButton render={<Toggle />} />`, `<ToolbarButton render={<MenuTrigger />} />`,
 * and a Tooltip wraps the other way round,
 * `<TooltipTrigger render={<ToolbarButton />} />`.
 *
 * ## Anatomy
 *
 *   Toolbar                          (Toolbar.Root — div role="toolbar", data-orientation)
 *     ├─ ToolbarButton               (Toolbar.Button — buttonVariants, ghost / icon-sm by default)
 *     ├─ ToolbarLink                 (Toolbar.Link — an anchor in the same roving order)
 *     ├─ ToolbarSeparator            (Toolbar.Separator — perpendicular to the toolbar)
 *     ├─ ToolbarGroup                (Toolbar.Group — role="group", name it with aria-label)
 *     └─ ToolbarInput                (Toolbar.Input — at most one, and last, in a horizontal bar)
 *
 * The one input goes last because Left and Right move the caret inside it,
 * so they cannot also move between controls; Base UI only lets the arrows out
 * at the ends of the text.
 *
 * ## MIN_VIEWPORT — 320
 *
 * The root wraps (`flex-wrap`), so a long bar breaks onto a second row at the
 * 320 floor instead of overflowing. Roving order follows the DOM, not the
 * rows, which is what a reader of the source order expects.
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends Base UI part props       | `React.ComponentProps<typeof BaseToolbar.*>`                |
 * | R6   | data-slot per part               | toolbar / -button / -link / -group / -separator / -input    |
 * | R7   | cn + ...rest                     | `cn(…, className)` + `{...props}`                           |
 * | R8   | Enums, no booleans               | `orientation`; Button's `variant` and `size`                |
 * | R12  | Reuse over wrap                  | Base UI owns roving focus; Button owns the button look      |
 * | R14  | Declares min viewport            | `data-min-viewport` + exported const                        |
 * | R19  | Tokens only                      | `bg-border`, `border-input`, `ring-ring/60`; the link inherits its colour |
 * | R25  | Client component                 | Required — Base UI Toolbar ships client hooks               |
 * | R26  | Keyboard contract                | arrows, Home / End, one Tab stop: asserted by `Toolbar.stories.tsx`, locked by `overlay-nav-keyboard-lock` |
 */

import * as React from 'react';
import { Toolbar as BaseToolbar } from '@base-ui/react/toolbar';
import type { VariantProps } from 'class-variance-authority';

import { cn } from '../lib/cn.js';
import { buttonVariants } from './button-variants.js';

/**
 * Minimum viable viewport (CSS px) — DESIGN_PRINCIPLES #14. The root wraps,
 * so nothing overflows at the 320 floor.
 */
export const MIN_VIEWPORT = 320 as const;

/**
 * Home and End: the WAI-ARIA toolbar pattern's jump to the first and last
 * control. Base UI's toolbar roves with the arrows only, so the root adds the
 * two keys over the same items, the ones Base UI gave a `tabindex`. Inside the
 * input they stay with the caret.
 */
function jumpToEnd(event: React.KeyboardEvent<HTMLDivElement>) {
  if (event.key !== 'Home' && event.key !== 'End') return;
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  if (event.target instanceof HTMLInputElement) return;
  const items = Array.from(
    // Any `tabindex`, -1 included: the roving model gives every item one.
    event.currentTarget.querySelectorAll<HTMLElement>(':is(button, a, input)[tabindex]'),
  );
  const target = event.key === 'Home' ? items[0] : items[items.length - 1];
  if (!target) return;
  event.preventDefault();
  target.focus();
}

function Toolbar({
  className,
  onKeyDown,
  ...props
}: React.ComponentProps<typeof BaseToolbar.Root>) {
  return (
    <BaseToolbar.Root
      data-slot="toolbar"
      data-min-viewport={String(MIN_VIEWPORT)}
      onKeyDown={(event) => {
        // A disabled-but-focusable button already prevented every key but
        // Tab, so only a prevent added by the caller's handler opts out.
        const prevented = event.defaultPrevented;
        onKeyDown?.(event);
        if (event.defaultPrevented && !prevented) return;
        jumpToEnd(event);
      }}
      className={cn(
        'group/toolbar flex flex-wrap items-center gap-1',
        'data-[orientation=vertical]:flex-col data-[orientation=vertical]:flex-nowrap data-[orientation=vertical]:items-stretch',
        className,
      )}
      {...props}
    />
  );
}

type ToolbarButtonProps = React.ComponentProps<typeof BaseToolbar.Button> &
  VariantProps<typeof buttonVariants>;

function ToolbarButton({ className, variant = 'ghost', size = 'icon-sm', ...props }: ToolbarButtonProps) {
  return (
    <BaseToolbar.Button
      data-slot="toolbar-button"
      // A disabled toolbar button stays focusable (Base UI's default): it gets
      // `aria-disabled` and `data-disabled`, not `disabled`, so it dims without
      // `pointer-events-none` and hovering it can still show why.
      className={cn(
        buttonVariants({ variant, size }),
        // An icon button is a square with no padding. Said outright so a
        // rendered Toggle's own `px-*` cannot squeeze the icon.
        size?.startsWith('icon') && 'p-0',
        'data-[disabled]:pointer-events-auto data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

function ToolbarLink({ className, ...props }: React.ComponentProps<typeof BaseToolbar.Link>) {
  return (
    <BaseToolbar.Link
      data-slot="toolbar-link"
      className={cn(
        // Inherits its colour and is underlined at rest, like Button's
        // `link` variant: a toolbar sits on surfaces the DS does not paint.
        'rounded-md px-2 py-1 text-sm underline decoration-from-font underline-offset-4 outline-none hover:decoration-2',
        'focus-visible:ring-ring/60 focus-visible:ring-[3px]',
        className,
      )}
      {...props}
    />
  );
}

function ToolbarGroup({ className, ...props }: React.ComponentProps<typeof BaseToolbar.Group>) {
  return (
    <BaseToolbar.Group
      data-slot="toolbar-group"
      className={cn(
        'flex items-center gap-1',
        'group-data-[orientation=vertical]/toolbar:flex-col',
        className,
      )}
      {...props}
    />
  );
}

function ToolbarSeparator({
  className,
  ...props
}: React.ComponentProps<typeof BaseToolbar.Separator>) {
  return (
    <BaseToolbar.Separator
      data-slot="toolbar-separator"
      // Base UI sets the separator's OWN orientation, perpendicular to the
      // toolbar's: a horizontal bar gets a vertical rule.
      className={cn(
        'bg-border shrink-0',
        'data-[orientation=vertical]:mx-1 data-[orientation=vertical]:h-5 data-[orientation=vertical]:w-px',
        'data-[orientation=horizontal]:my-1 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full',
        className,
      )}
      {...props}
    />
  );
}

function ToolbarInput({ className, ...props }: React.ComponentProps<typeof BaseToolbar.Input>) {
  return (
    <BaseToolbar.Input
      data-slot="toolbar-input"
      className={cn(
        'border-input bg-background text-foreground placeholder:text-muted-foreground h-8 min-w-0 rounded-lg border px-2.5 text-sm shadow-xs outline-none',
        'focus-visible:border-ring focus-visible:ring-ring/60 focus-visible:ring-[3px]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

export { Toolbar, ToolbarButton, ToolbarLink, ToolbarGroup, ToolbarSeparator, ToolbarInput };
export type { ToolbarButtonProps };
