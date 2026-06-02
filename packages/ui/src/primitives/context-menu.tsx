'use client';

/**
 * @interlace/ui — ContextMenu
 *
 * Right-click / long-press menu. Wraps `@base-ui/react/context-menu`
 * (same Menu compositional API as DropdownMenu, just with a Root that
 * handles right-click / long-press / Shift+F10 as the open gesture).
 *
 * For the standard click-button-to-open pattern, use `DropdownMenu`.
 * Use ContextMenu only when consumers expect a true OS-level
 * right-click affordance (file lists, editor canvases, image grids).
 *
 * ## Anatomy
 *
 *   ContextMenu                       (Root — Base UI manager)
 *     ├─ ContextMenuTrigger          (the right-clickable surface)
 *     └─ ContextMenuPortal
 *         └─ ContextMenuContent      (positioned popup; equivalent to
 *                                     DropdownMenu's Content — wraps
 *                                     Portal + Positioner + Popup)
 *             ├─ ContextMenuLabel
 *             ├─ ContextMenuGroup
 *             ├─ ContextMenuItem
 *             ├─ ContextMenuSeparator
 *             ├─ ContextMenuCheckboxItem
 *             └─ ContextMenuRadioGroup → ContextMenuRadioItem
 *
 * ## MIN_VIEWPORT — 320
 *
 * Long-press support works at every viewport.
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends Base UI part props       | Each wrapper extends `React.ComponentProps<typeof BaseContextMenu.X>` |
 * | R6   | data-slot per part               | `data-slot="context-menu-*"`                                |
 * | R7   | className merged + ...rest       | `cn(BASE, className)` + `{...props}`                        |
 * | R13  | Ecosystem first                  | Wraps Base UI's context-menu — no bespoke right-click handling |
 * | R14  | Declares min viewport            | `data-min-viewport={String(MIN_VIEWPORT)}` + exported const |
 * | R18  | Tailwind only                    | Zero inline `style`; styling lifted from DropdownMenu       |
 * | R19  | Tokens only                      | popover / accent / border / muted-foreground tokens         |
 * | R20  | AA contrast                      | Inherits semantic tokens which clear AAA                    |
 * | R25  | Client component                 | Base UI Menu hooks require client tier                      |
 * | R26  | A11y from headless primitive     | role="menu" + keyboard nav + focus management from Base UI  |
 */

import * as React from 'react';
import { ContextMenu as BaseContextMenu } from '@base-ui/react/context-menu';
import { CheckIcon, CircleIcon } from 'lucide-react';

import { cn } from '../lib/cn.js';

export const MIN_VIEWPORT = 320 as const;

function ContextMenu(
  props: React.ComponentProps<typeof BaseContextMenu.Root>,
) {
  return <BaseContextMenu.Root {...props} />;
}

function ContextMenuTrigger(
  props: React.ComponentProps<typeof BaseContextMenu.Trigger>,
) {
  return (
    <BaseContextMenu.Trigger
      data-slot="context-menu-trigger"
      data-min-viewport={String(MIN_VIEWPORT)}
      {...props}
    />
  );
}

function ContextMenuPortal(
  props: React.ComponentProps<typeof BaseContextMenu.Portal>,
) {
  return <BaseContextMenu.Portal data-slot="context-menu-portal" {...props} />;
}

function ContextMenuContent({
  className,
  side,
  sideOffset = 4,
  align = 'start',
  children,
  ...props
}: React.ComponentProps<typeof BaseContextMenu.Popup> & {
  side?: 'top' | 'right' | 'bottom' | 'left' | 'inline-start' | 'inline-end';
  sideOffset?: number;
  align?: 'start' | 'center' | 'end';
}) {
  return (
    <BaseContextMenu.Portal>
      <BaseContextMenu.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        className="z-50"
      >
        <BaseContextMenu.Popup
          data-slot="context-menu-content"
          className={cn(
            'bg-popover text-popover-foreground data-[open]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[open]:fade-in-0 data-[closed]:zoom-out-95 data-[open]:zoom-in-95 z-50 min-w-32 origin-(--transform-origin) overflow-hidden rounded-md border p-1 shadow-md outline-hidden',
            className,
          )}
          {...props}
        >
          {children}
        </BaseContextMenu.Popup>
      </BaseContextMenu.Positioner>
    </BaseContextMenu.Portal>
  );
}

function ContextMenuGroup(
  props: React.ComponentProps<typeof BaseContextMenu.Group>,
) {
  return <BaseContextMenu.Group data-slot="context-menu-group" {...props} />;
}

function ContextMenuItem({
  className,
  ...props
}: React.ComponentProps<typeof BaseContextMenu.Item>) {
  return (
    <BaseContextMenu.Item
      data-slot="context-menu-item"
      className={cn(
        'data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none',
        '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

function ContextMenuCheckboxItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof BaseContextMenu.CheckboxItem>) {
  return (
    <BaseContextMenu.CheckboxItem
      data-slot="context-menu-checkbox-item"
      className={cn(
        'data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
      )}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <BaseContextMenu.CheckboxItemIndicator>
          <CheckIcon className="size-4" />
        </BaseContextMenu.CheckboxItemIndicator>
      </span>
      {children}
    </BaseContextMenu.CheckboxItem>
  );
}

function ContextMenuRadioGroup(
  props: React.ComponentProps<typeof BaseContextMenu.RadioGroup>,
) {
  return <BaseContextMenu.RadioGroup data-slot="context-menu-radio-group" {...props} />;
}

function ContextMenuRadioItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof BaseContextMenu.RadioItem>) {
  return (
    <BaseContextMenu.RadioItem
      data-slot="context-menu-radio-item"
      className={cn(
        'data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
      )}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <BaseContextMenu.RadioItemIndicator>
          <CircleIcon className="size-2 fill-current" />
        </BaseContextMenu.RadioItemIndicator>
      </span>
      {children}
    </BaseContextMenu.RadioItem>
  );
}

function ContextMenuLabel({
  className,
  ...props
}: React.ComponentProps<typeof BaseContextMenu.GroupLabel>) {
  return (
    <BaseContextMenu.GroupLabel
      data-slot="context-menu-label"
      className={cn('text-muted-foreground px-2 py-1.5 text-xs font-semibold', className)}
      {...props}
    />
  );
}

function ContextMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof BaseContextMenu.Separator>) {
  return (
    <BaseContextMenu.Separator
      data-slot="context-menu-separator"
      className={cn('bg-border -mx-1 my-1 h-px', className)}
      {...props}
    />
  );
}

function ContextMenuShortcut({
  className,
  ...props
}: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="context-menu-shortcut"
      className={cn(
        'text-muted-foreground ml-auto text-xs tracking-widest',
        className,
      )}
      {...props}
    />
  );
}

/* ─────────────────────────────────────────────────────────────────
 * ContextMenuCompose — convenience composition. Same items API as
 * DropdownMenuCompose; only the trigger semantics differ.
 *
 *   <ContextMenuCompose
 *     trigger={<div className="w-64 h-32">Right-click me</div>}
 *     items={[
 *       { label: 'Open', onSelect: handleOpen, shortcut: '↩' },
 *       { type: 'separator' },
 *       { label: 'Delete', onSelect: handleDel, tone: 'destructive' },
 *     ]}
 *   />
 * ──────────────────────────────────────────────────────────────── */
type ContextMenuComposeItem =
  | {
      type?: 'item';
      label: React.ReactNode;
      onSelect?: () => void;
      shortcut?: React.ReactNode;
      disabled?: boolean;
      tone?: 'default' | 'destructive';
    }
  | { type: 'separator' }
  | { type: 'label'; label: React.ReactNode };

interface ContextMenuComposeProps {
  trigger: React.ReactNode;
  items: ContextMenuComposeItem[];
  className?: string;
}

function ContextMenuCompose({
  trigger,
  items,
  className,
}: ContextMenuComposeProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger render={trigger as React.ReactElement} />
      <ContextMenuContent className={className}>
        {items.map((item, i) => {
          if (item.type === 'separator') {
            return <ContextMenuSeparator key={i} />;
          }
          if (item.type === 'label') {
            return <ContextMenuLabel key={i}>{item.label}</ContextMenuLabel>;
          }
          return (
            <ContextMenuItem
              key={i}
              onClick={item.onSelect}
              disabled={item.disabled}
              data-tone={item.tone === 'destructive' ? 'destructive' : undefined}
              className={
                item.tone === 'destructive'
                  ? 'text-destructive data-[highlighted]:text-destructive'
                  : undefined
              }
            >
              {item.label}
              {item.shortcut ? (
                <ContextMenuShortcut>{item.shortcut}</ContextMenuShortcut>
              ) : null}
            </ContextMenuItem>
          );
        })}
      </ContextMenuContent>
    </ContextMenu>
  );
}

// Dotted access — `<ContextMenu.Compose ...>`. See dialog.tsx for pattern.
const ContextMenuWithDot = Object.assign(ContextMenu, {
  Compose: ContextMenuCompose,
}) as typeof ContextMenu & { Compose: typeof ContextMenuCompose };

export {
  ContextMenuWithDot as ContextMenu,
  ContextMenuTrigger,
  ContextMenuPortal,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuCheckboxItem,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuCompose,
};
export type { ContextMenuComposeProps, ContextMenuComposeItem };
