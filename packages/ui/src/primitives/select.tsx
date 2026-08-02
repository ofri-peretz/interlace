'use client';

/**
 * @interlace/ui — Select
 *
 * Single-select listbox with a portalled popup. Built on
 * @base-ui/react/select: Base UI owns `role="combobox"` / `role="listbox"`,
 * typeahead, arrow + Home/End navigation, focus return on close, and the
 * controlled/uncontrolled pair (`value` + `onValueChange` / `defaultValue`).
 * Mirrors: https://ui.shadcn.com/docs/components/select
 *
 * ## Anatomy
 *
 *   Select (Root)                            (no DOM — state provider)
 *     ├─ SelectTrigger                       (button — data-min-viewport=320)
 *     │   ├─ SelectValue                     (the current selection / placeholder)
 *     │   └─ (chevron icon)
 *     └─ SelectContent                       (portal → positioner → popup)
 *         ├─ SelectScrollUpButton
 *         ├─ SelectGroup → SelectGroupLabel
 *         ├─ SelectItem                      (repeats)
 *         ├─ SelectSeparator
 *         └─ SelectScrollDownButton
 *
 * ## Keyboard (owned by Base UI, asserted in Select.stories.tsx)
 *
 * | Key            | Action                                              |
 * | -------------- | --------------------------------------------------- |
 * | Space / Enter  | Open the popup; commit the highlighted item          |
 * | ↑ / ↓          | Move the highlight                                   |
 * | Home / End     | Jump to first / last item                            |
 * | a–z            | Typeahead to the matching item                       |
 * | Esc            | Close and return focus to the trigger                |
 *
 * ## MIN_VIEWPORT — 320
 *
 * The trigger is `w-fit`, so it never forces horizontal overflow; the popup
 * is width-anchored to the trigger via `min-w-(--anchor-width)` and scrolls
 * vertically rather than growing past the viewport.
 *
 * ## Contrast (verified by token math)
 *
 * | Composite                                            | Light  | Dark    | Floor           |
 * | ---------------------------------------------------- | ------ | ------- | --------------- |
 * | trigger `border-input` on `--background`             | 3.62:1 | 3.35:1  | 3:1 (SC 1.4.11) |
 * | `focus-visible:ring-ring/60` on `--background`       | 3.23:1 | 4.73:1  | 3:1 (SC 2.4.13) |
 * | item `text-popover-foreground` on `--popover`        | 19.65:1| 15.71:1  | 4.5:1 (SC 1.4.3)|
 * | highlighted `text-accent-foreground` on `--accent`   | 8.98:1 | 10.46:1 | 4.5:1 (SC 1.4.3)|
 * | selected `text-primary-foreground` on `--primary`    | 8.80:1 | 11.79:1 | 4.5:1 (SC 1.4.3)|
 * | group label `text-muted-foreground` on `--popover`   | 9.41:1 | 10.48:1  | 4.5:1 (SC 1.4.3)|
 *
 * `data-disabled:opacity-50` is exempt — SC 1.4.3 carves out inactive
 * user-interface components.
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends Base UI part props       | each wrapper extends its Base UI part's props               |
 * | R6   | data-slot per part               | `select-trigger` / `-positioner` / `-popup` / `-item` / …   |
 * | R7   | className merged + ...rest       | `cn(BASE, className)` + `{...props}` on every part          |
 * | R11  | Composition over prop-drilling   | items are children, not an `options` array prop             |
 * | R12  | Reuse over wrap                  | Base UI owns typeahead, positioning and ARIA                |
 * | R14  | Declares min viewport            | `data-min-viewport={String(MIN_VIEWPORT)}` on the trigger   |
 * | R18  | Tailwind only                    | zero inline `style`                                         |
 * | R19  | Tokens only                      | semantic colour tokens throughout                           |
 * | R20  | AA contrast                      | table above — every composite measured                      |
 * | R25  | Client component                 | required — Base UI Select ships client hooks                |
 * | R26  | A11y from upstream               | combobox/listbox ARIA + full keyboard model                 |
 */

import * as React from 'react';
import { Select as BaseSelect } from '@base-ui/react/select';
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from 'lucide-react';

import { cn } from '../lib/cn.js';

/** Smallest viable viewport (CSS px) for this primitive. */
export const MIN_VIEWPORT = 320 as const;

const Select = BaseSelect.Root;
const SelectGroup = BaseSelect.Group;
function SelectValue({
  placeholder,
  ...props
}: React.ComponentProps<typeof BaseSelect.Value> & {
  placeholder?: React.ReactNode;
}) {
  // Base UI's `Select.Value` types `placeholder` narrower than the ReactNode
  // we want to accept. Narrow cast rather than `as any` so a future upstream
  // signature change still fails the build here.
  const Component = BaseSelect.Value as React.ComponentType<
    React.ComponentProps<typeof BaseSelect.Value> & {
      placeholder?: React.ReactNode;
    }
  >;
  return <Component placeholder={placeholder} {...props} />;
}
const SelectPortal = BaseSelect.Portal;

function SelectTrigger({
  className,
  size = 'default',
  children,
  ...props
}: React.ComponentProps<typeof BaseSelect.Trigger> & {
  size?: 'sm' | 'default';
}) {
  return (
    <BaseSelect.Trigger
      data-slot="select-trigger"
      data-min-viewport={String(MIN_VIEWPORT)}
      data-size={size}
      className={cn(
        'flex w-fit items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm whitespace-nowrap shadow-sm transition-[color,box-shadow] outline-none',
        'hover:bg-accent hover:text-accent-foreground',
        // /60 not /50 — 50%-alpha primary composites to 2.57:1 on white,
        // under the 3:1 focus-indicator floor (SC 2.4.13).
        'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/60',
        'data-popup-open:border-ring',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'data-[size=default]:h-9 data-[size=sm]:h-8',
        '[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-4',
        className,
      )}
      {...props}
    >
      {children}
      <BaseSelect.Icon className="opacity-50">
        <ChevronDownIcon className="size-4" />
      </BaseSelect.Icon>
    </BaseSelect.Trigger>
  );
}

function SelectContent({
  className,
  children,
  sideOffset = 4,
  popupClassName,
  ...props
}: React.ComponentProps<typeof BaseSelect.Positioner> & {
  popupClassName?: string;
}) {
  return (
    <BaseSelect.Portal>
      <BaseSelect.Positioner
        data-slot="select-positioner"
        sideOffset={sideOffset}
        className={cn('z-50', className)}
        {...props}
      >
        <SelectScrollUpButton />
        <BaseSelect.Popup
          data-slot="select-popup"
          className={cn(
            'min-w-(--anchor-width) overflow-x-hidden overflow-y-auto rounded-xl border border-border bg-popover text-popover-foreground shadow-lg',
            'origin-(--transform-origin)',
            'data-starting-style:opacity-0 data-starting-style:scale-95',
            'data-ending-style:opacity-0 data-ending-style:scale-95',
            'transition-[opacity,scale] duration-150',
            'p-1',
            popupClassName,
          )}
        >
          {children}
        </BaseSelect.Popup>
        <SelectScrollDownButton />
      </BaseSelect.Positioner>
    </BaseSelect.Portal>
  );
}

function SelectGroupLabel({
  className,
  ...props
}: React.ComponentProps<typeof BaseSelect.GroupLabel>) {
  return (
    <BaseSelect.GroupLabel
      data-slot="select-group-label"
      className={cn('px-2 py-1.5 text-xs text-muted-foreground', className)}
      {...props}
    />
  );
}

function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof BaseSelect.Item>) {
  return (
    <BaseSelect.Item
      data-slot="select-item"
      className={cn(
        'relative flex w-full cursor-pointer items-center gap-2 rounded-lg py-2.5 pr-8 pl-3 text-sm outline-hidden select-none transition-all duration-150',
        'text-popover-foreground',
        'data-highlighted:bg-accent data-highlighted:text-accent-foreground',
        'data-selected:bg-primary data-selected:text-primary-foreground data-selected:font-medium',
        'data-disabled:pointer-events-none data-disabled:opacity-50',
        '[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-4',
        className,
      )}
      {...props}
    >
      <span className="absolute right-2 flex size-3.5 items-center justify-center">
        <BaseSelect.ItemIndicator>
          <CheckIcon className="size-4" />
        </BaseSelect.ItemIndicator>
      </span>
      <BaseSelect.ItemText>{children}</BaseSelect.ItemText>
    </BaseSelect.Item>
  );
}

function SelectSeparator({
  className,
  ...props
}: React.ComponentProps<typeof BaseSelect.Separator>) {
  return (
    <BaseSelect.Separator
      data-slot="select-separator"
      className={cn('pointer-events-none -mx-1 my-1 h-px bg-border', className)}
      {...props}
    />
  );
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof BaseSelect.ScrollUpArrow>) {
  return (
    <BaseSelect.ScrollUpArrow
      data-slot="select-scroll-up"
      className={cn(
        'flex cursor-default items-center justify-center py-1 text-muted-foreground',
        className,
      )}
      {...props}
    >
      <ChevronUpIcon className="size-4" />
    </BaseSelect.ScrollUpArrow>
  );
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof BaseSelect.ScrollDownArrow>) {
  return (
    <BaseSelect.ScrollDownArrow
      data-slot="select-scroll-down"
      className={cn(
        'flex cursor-default items-center justify-center py-1 text-muted-foreground',
        className,
      )}
      {...props}
    >
      <ChevronDownIcon className="size-4" />
    </BaseSelect.ScrollDownArrow>
  );
}

export {
  Select,
  SelectGroup,
  SelectGroupLabel,
  SelectValue,
  SelectPortal,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
};
