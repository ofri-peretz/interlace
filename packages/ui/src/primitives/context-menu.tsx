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
 * | R26  | A11y from headless primitive     | role="menu" + keyboard nav + focus management from Base UI; ContextMenuTrigger adds the Shift+F10 / Menu-key opener Base UI omits |
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

/**
 * Right-click surface.
 *
 * ## Keyboard opening (our addition — Base UI does not ship it)
 *
 * `@base-ui/react/context-menu` opens on `contextmenu` (right-click /
 * long-press) only. A menu with no keyboard path to open it is a WCAG 2.1.1
 * (Keyboard) failure, and it is invisible to axe because the menu simply
 * isn't in the DOM until a pointer event fires. So the trigger:
 *
 *   - joins the tab order (`tabIndex` defaults to `0`), and
 *   - synthesises a `contextmenu` event on **Shift+F10** and on the
 *     dedicated **Menu / ContextMenu** key — the two bindings the WAI-ARIA
 *     APG names for this pattern.
 *
 * Pass `tabIndex={-1}` to opt a decorative trigger out of the tab order; the
 * key handler then only fires if something else focuses it.
 */
function ContextMenuTrigger({
  onKeyDown,
  tabIndex = 0,
  ...props
}: React.ComponentProps<typeof BaseContextMenu.Trigger>) {
  // Base UI wraps the React event (`BaseUIEvent<…>`), so derive the handler
  // signature from the component's own props rather than hand-typing it.
  type TriggerKeyDown = NonNullable<
    React.ComponentProps<typeof BaseContextMenu.Trigger>['onKeyDown']
  >;
  const handleKeyDown: TriggerKeyDown = (event) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;

    const isMenuKey = event.key === 'ContextMenu';
    const isShiftF10 = event.key === 'F10' && event.shiftKey;
    if (!isMenuKey && !isShiftF10) return;

    event.preventDefault();
    // Open at the element's own centre so the popup is anchored to the
    // thing the user focused, not to wherever the pointer happens to rest.
    // Browsers deliver `contextmenu` as a PointerEvent, and Base UI reads
    // pointer fields off it — a plain MouseEvent throws inside the handler.
    const target = event.currentTarget;
    const box = target.getBoundingClientRect();
    const init: PointerEventInit = {
      bubbles: true,
      cancelable: true,
      button: 2,
      buttons: 0,
      pointerType: 'mouse',
      clientX: box.left + box.width / 2,
      clientY: box.top + box.height / 2,
    };
    target.dispatchEvent(
      typeof PointerEvent === 'function'
        ? new PointerEvent('contextmenu', init)
        : new MouseEvent('contextmenu', init),
    );
  };

  return (
    <BaseContextMenu.Trigger
      data-slot="context-menu-trigger"
      data-min-viewport={String(MIN_VIEWPORT)}
      tabIndex={tabIndex}
      onKeyDown={handleKeyDown}
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
        {renderComposeItems(items)}
      </ContextMenuContent>
    </ContextMenu>
  );
}

/**
 * Renders the flat `items` array into the nested tree Base UI requires.
 *
 * A `label` item is `Menu.GroupLabel`, which THROWS unless it sits inside a
 * `Menu.Group` ("Base UI error #31"). The crash is invisible until the menu
 * actually opens — every closed-by-default story renders fine — so a flat
 * `<ContextMenuLabel>` shipped happily and blew up on first right-click.
 *
 * A label therefore opens a group that runs until the next label or
 * separator. That's also the correct semantics: the group is what the label
 * labels, so assistive tech announces "Danger zone, group" instead of a
 * floating string.
 */
function renderComposeItems(items: ContextMenuComposeItem[]) {
  const out: React.ReactNode[] = [];
  let group: React.ReactNode[] = [];
  let groupLabel: React.ReactNode = null;
  let groupKey = 0;

  const flushGroup = () => {
    if (groupLabel === null && group.length === 0) return;
    out.push(
      <ContextMenuGroup key={`group-${groupKey++}`}>
        {groupLabel !== null ? (
          <ContextMenuLabel>{groupLabel}</ContextMenuLabel>
        ) : null}
        {group}
      </ContextMenuGroup>,
    );
    group = [];
    groupLabel = null;
  };

  items.forEach((item, i) => {
    if (item.type === 'separator') {
      flushGroup();
      out.push(<ContextMenuSeparator key={i} />);
      return;
    }
    if (item.type === 'label') {
      flushGroup();
      groupLabel = item.label;
      return;
    }
    const node = (
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
    // Items before any label stay ungrouped — wrapping them in an unlabelled
    // group would add a meaningless `role="group"` to the a11y tree.
    if (groupLabel === null && group.length === 0) out.push(node);
    else group.push(node);
  });

  flushGroup();
  return out;
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
