'use client';

/**
 * @interlace/ui — Combobox
 *
 * A text input that filters a list. Built on `@base-ui/react/combobox`: Base UI
 * owns the filtering (`Intl.Collator`-backed `useFilter`), the
 * combobox/listbox ARIA pairing, VIRTUAL focus (the input keeps DOM focus and
 * `aria-activedescendant` moves), single + multiple selection, chips, and the
 * whole keyboard model. We own the surface — size, tokens, focus ring, target
 * sizes.
 * Mirrors: https://ui.shadcn.com/docs/components/combobox
 *
 * ## Combobox vs Select vs DropdownMenu
 *
 * `Select` is the right primitive when the user picks from a list they can
 * read at a glance and can NOT type into. `Combobox` is for the list that is
 * too long to scan — the user types to narrow it. `DropdownMenu` is for
 * ACTIONS, not values. Reaching for a Combobox under ~7 options is a
 * downgrade: it trades a one-keystroke listbox for a text field.
 *
 * ## Anatomy
 *
 *   Combobox (Root)                          (no DOM — state + filtering)
 *     ├─ ComboboxChips                       (multiple only)
 *     │   └─ ComboboxChip → ComboboxChipRemove
 *     ├─ ComboboxControl                     (ours — relative row, no Base UI part)
 *     │   ├─ ComboboxInput                   (input — data-min-viewport=320)
 *     │   ├─ ComboboxClear                   (button, keepMounted=false)
 *     │   └─ ComboboxTrigger → ComboboxIcon  (optional open button)
 *     └─ ComboboxContent                     (portal → positioner → popup)
 *         ├─ ComboboxEmpty                   (renders only when 0 results)
 *         ├─ ComboboxStatus                  (polite live region — async lists)
 *         └─ ComboboxList
 *             ├─ ComboboxGroup → ComboboxGroupLabel
 *             ├─ ComboboxItem                (repeats)
 *             └─ ComboboxSeparator
 *
 * ## Filtering — the one trap in this API
 *
 * Base UI filters through `ComboboxCollection`, which `ComboboxList` wraps
 * implicitly when its child is a FUNCTION. Both of these render; only the
 * first one filters:
 *
 *   <ComboboxList>{(item) => <ComboboxItem value={item}>…</ComboboxItem>}</ComboboxList>   ✅
 *   <ComboboxList>{items.map((item) => <ComboboxItem …/>)}</ComboboxList>                  ❌
 *
 * The mapped form is not an error and looks correct at rest — it just shows
 * every row no matter what is typed, which reads as "the filter is broken"
 * rather than as "the wrong child shape". It also needs `items` on the root:
 * without it there is no source list to filter, and `ComboboxEmpty` can never
 * know the list is empty rather than merely unmounted.
 *
 * Static rows that must never be filtered (a "Create new…" affordance) are
 * the legitimate use of the mapped form, alongside a function child.
 *
 * ## Keyboard contract
 *
 * Read from the installed Base UI source (`combobox/input/ComboboxInput.js`,
 * `combobox/root/AriaCombobox.js`), not from the shadcn/Radix model — three
 * rows below differ from `Select` and getting them wrong is how a combobox
 * ships an unusable text field. Asserted in `Combobox.stories.tsx`
 * (`KeyboardFlow`) and locked by `combobox-keyboard-lock.test.ts`.
 *
 * | Key             | Action                                                   |
 * | --------------- | -------------------------------------------------------- |
 * | a–z / any glyph | Filter the list; the popup opens on the first keystroke   |
 * | ↓ / ↑           | Move the highlight; opens the popup when closed. Wraps    |
 * |                 | (`loopFocus: true`) — last ↓ returns to the first item     |
 * | Enter           | Commit the highlighted item; closes the popup             |
 * | Esc (open)      | Close the popup. Focus never moved, so nothing to restore |
 * | Esc (closed)    | Clear the input AND the selection — NOT a no-op           |
 * | Home / End      | Move the TEXT CARET. They do NOT jump to first/last item; |
 * |                 | Base UI stops the event on the input. This is the         |
 * |                 | opposite of `Select`, where Home/End rove the listbox     |
 * | Backspace       | With an empty input in `multiple` mode, removes the last  |
 * |                 | chip                                                      |
 * | Tab             | Leaves the field. The popup is not a tab stop — items are |
 * |                 | reached with arrows, never with Tab                       |
 *
 * FOCUS NEVER ENTERS THE LIST. `useListNavigation` runs with `virtual: true`,
 * so `document.activeElement` stays the input for the entire interaction and
 * the highlight is published as `aria-activedescendant`. A test that asserts
 * `activeElement.role === 'option'` (the correct assertion for `Select`) is
 * asserting a bug here.
 *
 * ## MIN_VIEWPORT — 320
 *
 * The input is `w-full` and the popup is width-anchored to it
 * (`min-w-(--anchor-width)`) and height-capped by `max-h-(--available-height)`,
 * so it scrolls rather than growing past a 320px viewport. Every hit target
 * (item 36px, clear 28px, chip remove 24px) clears the 24px floor of
 * SC 2.5.8 at that width.
 *
 * ## Contrast (verified by token math)
 *
 * Identical token pairs on identical surfaces to `select.tsx`; the measured
 * figures are carried over from `interlace-theme.css`.
 *
 * | Composite                                            | Light   | Dark    | Floor           |
 * | ---------------------------------------------------- | ------- | ------- | --------------- |
 * | input `border-input` on `--background`               | 3.62:1  | 3.35:1  | 3:1 (SC 1.4.11) |
 * | `focus-visible:ring-ring/60` on `--background`       | 3.23:1  | 4.73:1  | 3:1 (SC 2.4.13) |
 * | `placeholder:text-muted-foreground` on `--background`| 9.41:1  | 8.74:1  | 4.5:1 (SC 1.4.3)|
 * | item `text-popover-foreground` on `--popover`        | 19.65:1 | 15.71:1 | 4.5:1 (SC 1.4.3)|
 * | highlighted `text-accent-foreground` on `--accent`   | 8.98:1  | 10.46:1 | 4.5:1 (SC 1.4.3)|
 * | selected `text-primary-foreground` on `--primary`    | 8.80:1  | 11.79:1 | 4.5:1 (SC 1.4.3)|
 * | group label `text-muted-foreground` on `--popover`   | 9.41:1  | 10.48:1 | 4.5:1 (SC 1.4.3)|
 *
 * The focus ring is 3px (`ring-[3px]`), over the 2px minimum of SC 2.4.13, and
 * `/60` rather than `/50` because 50%-alpha primary composites to 2.57:1 on
 * white — under the 3:1 indicator floor.
 *
 * `data-disabled:opacity-50` is exempt — SC 1.4.3 carves out inactive
 * user-interface components.
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends Base UI part props       | each wrapper extends its Base UI part's props               |
 * | R6   | data-slot per part               | `combobox-input` / `-control` / `-popup` / `-item` / …      |
 * | R7   | className merged + ...rest       | `cn(BASE, className)` + `{...props}` on every part          |
 * | R8   | No `isXxx` prefix on booleans    | `multiple`, `disabled`, `readOnly` — inherited, no `is`     |
 * | R11  | Composition over prop-drilling   | items are children; `ComboboxCompose` is the escape hatch   |
 * | R12  | Reuse over wrap                  | Base UI owns filtering, ARIA, virtual focus, chips          |
 * | R14  | Controlled + uncontrolled        | `value`/`onValueChange` + `defaultValue`, ditto `inputValue`|
 * | R17  | API parity with shadcn           | part names mirror shadcn's Command/Combobox surface         |
 * | R18  | Tailwind only                    | zero inline `style`                                         |
 * | R19  | Tokens only                      | semantic colour tokens throughout — no raw hex              |
 * | R20  | AA contrast                      | table above — every composite measured                      |
 * | R25  | Client component                 | required — Base UI Combobox ships client hooks              |
 * | R26  | A11y from upstream               | combobox/listbox ARIA + the full keyboard model             |
 */

import * as React from 'react';
import { Combobox as BaseCombobox } from '@base-ui/react/combobox';
import { CheckIcon, ChevronDownIcon, XIcon } from 'lucide-react';

import { cn } from '../lib/cn.js';

/** Smallest viable viewport (CSS px) for this primitive. */
export const MIN_VIEWPORT = 320 as const;

/**
 * Root. Renders no DOM of its own, so it is aliased rather than wrapped —
 * wrapping would erase the `<Value, Multiple>` generics that make
 * `onValueChange` typed at the call site.
 */
const Combobox = BaseCombobox.Root;
const ComboboxValue = BaseCombobox.Value;
const ComboboxPortal = BaseCombobox.Portal;
/** Renders the filtered items from `items` — for the closed-template API. */
const ComboboxCollection = BaseCombobox.Collection;

/**
 * The input row. Ours, not a Base UI part: Base UI has no concept of "the
 * input plus the affordances docked inside its box", and a `relative` wrapper
 * is the only way `ComboboxClear` / `ComboboxTrigger` can sit inside the
 * field's border instead of beside it.
 */
function ComboboxControl({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="combobox-control"
      className={cn('relative flex w-full items-center', className)}
      {...props}
    />
  );
}

function ComboboxInput({
  className,
  size = 'default',
  ...props
}: Omit<React.ComponentProps<typeof BaseCombobox.Input>, 'size'> & {
  /**
   * Control height. Shadows the native `size` attribute (character width),
   * which no design system call-site wants and which would intersect to
   * `never` if both were kept. Destructured, never spread — a literal
   * `size="sm"` on an `<input>` is invalid HTML.
   */
  size?: 'sm' | 'default';
}) {
  return (
    <BaseCombobox.Input
      data-slot="combobox-input"
      data-min-viewport={String(MIN_VIEWPORT)}
      data-size={size}
      className={cn(
        'border-input placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm',
        'data-[size=default]:h-9 data-[size=sm]:h-8',
        // /60 not /50 — 50%-alpha primary composites to 2.57:1 on white,
        // under the 3:1 focus-indicator floor (SC 2.4.13). 3px > the 2px
        // minimum thickness the same SC requires.
        'focus-visible:border-ring focus-visible:ring-ring/60 focus-visible:ring-[3px]',
        'aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40',
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

/**
 * Optional button that opens the popup without typing. Docked inside the
 * field, so the input reserves room for it with `pr-9` at the call site.
 * 28px square — over the 24px floor of SC 2.5.8.
 */
function ComboboxTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof BaseCombobox.Trigger>) {
  return (
    <BaseCombobox.Trigger
      data-slot="combobox-trigger"
      className={cn(
        'text-muted-foreground hover:text-foreground absolute end-1 flex size-7 items-center justify-center rounded-sm transition-colors outline-none',
        'focus-visible:ring-ring/60 focus-visible:ring-[3px]',
        'disabled:pointer-events-none disabled:opacity-50',
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      {children ?? (
        <BaseCombobox.Icon data-slot="combobox-icon">
          <ChevronDownIcon />
        </BaseCombobox.Icon>
      )}
    </BaseCombobox.Trigger>
  );
}

function ComboboxIcon({
  className,
  ...props
}: React.ComponentProps<typeof BaseCombobox.Icon>) {
  return (
    <BaseCombobox.Icon
      data-slot="combobox-icon"
      className={cn('flex items-center', className)}
      {...props}
    />
  );
}

/**
 * Clears the value. Unmounted until there IS one, so it never occupies a tab
 * stop that does nothing.
 *
 * "Value" means the SELECTED item, not the typed query — a half-typed filter
 * with no selection shows no clear button, because Escape already clears the
 * query and a second affordance for it would be noise. Set `keepMounted` if
 * a stable layout matters more than the empty tab stop.
 */
function ComboboxClear({
  className,
  children,
  ...props
}: React.ComponentProps<typeof BaseCombobox.Clear>) {
  return (
    <BaseCombobox.Clear
      data-slot="combobox-clear"
      className={cn(
        'text-muted-foreground hover:text-foreground absolute end-1 flex size-7 items-center justify-center rounded-sm transition-colors outline-none',
        'focus-visible:ring-ring/60 focus-visible:ring-[3px]',
        'disabled:pointer-events-none disabled:opacity-50',
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      {children ?? (
        <>
          <XIcon />
          <span className="sr-only">Clear</span>
        </>
      )}
    </BaseCombobox.Clear>
  );
}

function ComboboxContent({
  className,
  children,
  sideOffset = 4,
  popupClassName,
  ...props
}: React.ComponentProps<typeof BaseCombobox.Positioner> & {
  popupClassName?: string;
}) {
  return (
    <BaseCombobox.Portal>
      <BaseCombobox.Positioner
        data-slot="combobox-positioner"
        sideOffset={sideOffset}
        className={cn('z-50', className)}
        {...props}
      >
        <BaseCombobox.Popup
          data-slot="combobox-popup"
          data-min-viewport={String(MIN_VIEWPORT)}
          className={cn(
            'border-border bg-popover text-popover-foreground max-h-(--available-height) min-w-(--anchor-width) overflow-x-hidden overflow-y-auto rounded-xl border p-1 shadow-lg',
            'origin-(--transform-origin)',
            'data-starting-style:scale-95 data-starting-style:opacity-0',
            'data-ending-style:scale-95 data-ending-style:opacity-0',
            'transition-[opacity,scale] duration-150',
            popupClassName,
          )}
        >
          {children}
        </BaseCombobox.Popup>
      </BaseCombobox.Positioner>
    </BaseCombobox.Portal>
  );
}

function ComboboxList({
  className,
  ...props
}: React.ComponentProps<typeof BaseCombobox.List>) {
  return (
    <BaseCombobox.List
      data-slot="combobox-list"
      className={cn('flex flex-col outline-none', className)}
      {...props}
    />
  );
}

function ComboboxItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof BaseCombobox.Item>) {
  return (
    <BaseCombobox.Item
      data-slot="combobox-item"
      className={cn(
        // 36px tall (py-2 + text-sm line box) — over the 24px floor of
        // SC 2.5.8 at the 320px viewport.
        'text-popover-foreground relative flex w-full cursor-pointer items-center gap-2 rounded-lg py-2 pr-8 pl-3 text-sm transition-colors duration-150 outline-hidden select-none',
        'data-highlighted:bg-accent data-highlighted:text-accent-foreground',
        'data-selected:bg-primary data-selected:text-primary-foreground data-selected:font-medium',
        'data-disabled:pointer-events-none data-disabled:opacity-50',
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      {children}
      <span className="absolute end-2 flex size-3.5 items-center justify-center">
        <BaseCombobox.ItemIndicator data-slot="combobox-item-indicator">
          <CheckIcon className="size-4" />
        </BaseCombobox.ItemIndicator>
      </span>
    </BaseCombobox.Item>
  );
}

function ComboboxGroup({
  className,
  ...props
}: React.ComponentProps<typeof BaseCombobox.Group>) {
  return (
    <BaseCombobox.Group
      data-slot="combobox-group"
      className={cn('flex flex-col', className)}
      {...props}
    />
  );
}

function ComboboxGroupLabel({
  className,
  ...props
}: React.ComponentProps<typeof BaseCombobox.GroupLabel>) {
  return (
    <BaseCombobox.GroupLabel
      data-slot="combobox-group-label"
      className={cn(
        'text-muted-foreground px-3 py-1.5 text-xs font-medium',
        className,
      )}
      {...props}
    />
  );
}

/**
 * Renders only when the filtered list is empty, and announces itself
 * politely. Requires `items` on the root — without it Base UI cannot know
 * the list is empty rather than merely unmounted.
 *
 * `empty:py-0` is not cosmetic. Base UI keeps this element mounted at all
 * times — it is a `role="status" aria-live="polite"` region, and a live
 * region has to exist BEFORE its content changes or the change is never
 * announced. It only drops its children. So without the collapse, `py-6`
 * reserves a 48px dead band above every non-empty result list, and the
 * popup looks broken with no element to blame it on. Measured in Chromium,
 * not guessed: jsdom reports every box as 0×0.
 *
 * `empty:hidden` would also close the gap and is what several other
 * libraries do — it is the wrong fix, because `display: none` takes the
 * region out of the accessibility tree, and a live region that appears in
 * the same frame as its content is a live region screen readers skip.
 */
function ComboboxEmpty({
  className,
  ...props
}: React.ComponentProps<typeof BaseCombobox.Empty>) {
  return (
    <BaseCombobox.Empty
      data-slot="combobox-empty"
      className={cn(
        'text-muted-foreground px-3 py-6 text-center text-sm empty:py-0',
        className,
      )}
      {...props}
    />
  );
}

/**
 * A polite live region for async list state ("Loading…", "12 results"). Not
 * the same thing as `ComboboxEmpty`: this one is always mounted, so a change
 * of its text is announced.
 */
function ComboboxStatus({
  className,
  ...props
}: React.ComponentProps<typeof BaseCombobox.Status>) {
  return (
    <BaseCombobox.Status
      data-slot="combobox-status"
      className={cn('text-muted-foreground px-3 py-2 text-xs', className)}
      {...props}
    />
  );
}

function ComboboxSeparator({
  className,
  ...props
}: React.ComponentProps<typeof BaseCombobox.Separator>) {
  return (
    <BaseCombobox.Separator
      data-slot="combobox-separator"
      className={cn('bg-border pointer-events-none -mx-1 my-1 h-px', className)}
      {...props}
    />
  );
}

/**
 * The chip rail for `multiple` — wraps the chips AND the input.
 *
 * Give the nested input a floor (`min-w-24 flex-1`), not `flex-1` alone: a
 * flex child with `min-w-0` shrinks to nothing before the row wraps, so with
 * two chips in the rail the text field collapses to ~40px and the
 * placeholder is a single clipped letter. Verified in Chromium — jsdom has
 * no layout and reports it as fine.
 *
 * Only the border changes on focus, with no `ring-*`: the input inside the
 * rail already carries the DS-wide `:focus-visible` outline from
 * `styles/preflight.css`, and stacking a container ring on top of it is two
 * indicators for one focus.
 */
function ComboboxChips({
  className,
  ...props
}: React.ComponentProps<typeof BaseCombobox.Chips>) {
  return (
    <BaseCombobox.Chips
      data-slot="combobox-chips"
      className={cn(
        'border-input dark:bg-input/30 flex w-full flex-wrap items-center gap-1.5 rounded-md border bg-transparent p-1.5 shadow-xs',
        'focus-within:border-ring',
        className,
      )}
      {...props}
    />
  );
}

function ComboboxChip({
  className,
  ...props
}: React.ComponentProps<typeof BaseCombobox.Chip>) {
  return (
    <BaseCombobox.Chip
      data-slot="combobox-chip"
      className={cn(
        'bg-secondary text-secondary-foreground flex h-7 items-center gap-1 rounded-md pr-1 pl-2 text-sm outline-none',
        'data-highlighted:bg-accent data-highlighted:text-accent-foreground',
        className,
      )}
      {...props}
    />
  );
}

function ComboboxChipRemove({
  className,
  children,
  ...props
}: React.ComponentProps<typeof BaseCombobox.ChipRemove>) {
  return (
    <BaseCombobox.ChipRemove
      data-slot="combobox-chip-remove"
      className={cn(
        // 24px square — exactly the SC 2.5.8 floor. Do not shrink it to
        // match the icon; the icon is 12px and the target is not the icon.
        'flex size-6 items-center justify-center rounded-sm transition-colors outline-none',
        'hover:bg-accent hover:text-accent-foreground',
        'focus-visible:ring-ring/60 focus-visible:ring-[3px]',
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3",
        className,
      )}
      {...props}
    >
      {children ?? <XIcon />}
    </BaseCombobox.ChipRemove>
  );
}

/* ─────────────────────────────────────────────────────────────────
 * ComboboxCompose — convenience composition.
 *
 * The single-select "type to filter a flat list" case, which is ~80% of
 * combobox call-sites, in one element. Anything else — groups, chips,
 * per-row icons, async status — composes the parts above.
 *
 *   <ComboboxCompose
 *     items={plugins}
 *     placeholder="Search plugins…"
 *     emptyMessage="No plugin matches."
 *     onValueChange={setPlugin}
 *   />
 *
 * `items` is `{ value, label }[]` because Base UI resolves exactly that
 * shape to a display string with no `itemToStringLabel` prop.
 * ──────────────────────────────────────────────────────────────── */
interface ComboboxComposeItem {
  value: string;
  label: string;
  disabled?: boolean;
}

interface ComboboxComposeProps {
  /** The full, unfiltered list. Base UI filters it against the query. */
  items: readonly ComboboxComposeItem[];
  /** Placeholder for the text input. */
  placeholder?: string;
  /** Shown when the query matches nothing. */
  emptyMessage?: React.ReactNode;
  /** Accessible name for the input. Required — the field has no visible label. */
  'aria-label'?: string;
  /** Initially selected item. Uncontrolled. */
  defaultValue?: ComboboxComposeItem | null;
  /** Selected item. Controlled — pair with `onValueChange`. */
  value?: ComboboxComposeItem | null;
  /** Fired with the newly selected item, or `null` when cleared. */
  onValueChange?: (value: ComboboxComposeItem | null) => void;
  /** Form field name — projected onto the hidden input. */
  name?: string;
  /** Ignore all interaction. */
  disabled?: boolean;
  /** Show a clear button once the field has a value. */
  clearable?: boolean;
  /** Override the control className (width). */
  className?: string;
}

function ComboboxCompose({
  items,
  placeholder,
  emptyMessage = 'No results found.',
  'aria-label': ariaLabel,
  defaultValue,
  value,
  onValueChange,
  name,
  disabled,
  clearable = true,
  className,
}: ComboboxComposeProps) {
  return (
    <Combobox
      items={items}
      defaultValue={defaultValue}
      value={value}
      onValueChange={onValueChange}
      name={name}
      disabled={disabled}
    >
      <ComboboxControl className={className}>
        <ComboboxInput
          placeholder={placeholder}
          aria-label={ariaLabel}
          className={clearable ? 'pr-9' : undefined}
        />
        {clearable ? <ComboboxClear /> : null}
      </ComboboxControl>
      <ComboboxContent>
        <ComboboxEmpty>{emptyMessage}</ComboboxEmpty>
        {/* Function child, NOT `items.map(...)` — see the Filtering note in
            the file header. A mapped list renders every row forever. */}
        <ComboboxList>
          {(item: ComboboxComposeItem) => (
            <ComboboxItem key={item.value} value={item} disabled={item.disabled}>
              {item.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

export {
  Combobox,
  ComboboxChip,
  ComboboxChipRemove,
  ComboboxChips,
  ComboboxClear,
  ComboboxCollection,
  ComboboxCompose,
  ComboboxContent,
  ComboboxControl,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxGroupLabel,
  ComboboxIcon,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxPortal,
  ComboboxSeparator,
  ComboboxStatus,
  ComboboxTrigger,
  ComboboxValue,
};
export type { ComboboxComposeItem, ComboboxComposeProps };
