'use client';

/**
 * @interlace/ui — CommandPalette
 *
 * ⌘K. A modal surface holding one filterable list of actions.
 *
 * This is a COMPOSITION, not a new primitive: `Dialog` supplies the modal
 * (backdrop, focus trap, page inert, Escape, focus restore to the trigger),
 * and `@base-ui/react/combobox` in `inline` mode supplies the field and the
 * list (filtering, listbox ARIA, virtual focus, highlight). Neither half is
 * reimplemented here — this file is the ~200 lines of surface that sit
 * between them.
 * Mirrors: https://ui.shadcn.com/docs/components/command (`CommandDialog`)
 *
 * ## Why `inline` is load-bearing
 *
 * `inline` is not a styling flag. It is the prop that makes a combobox
 * legal inside a dialog, and Base UI's own source says so
 * (`combobox/root/AriaCombobox.js`: "Support composing the Dialog component
 * around an inline combobox"). Three things change:
 *
 *   1. No portal, no positioner. `ComboboxList` registers ITSELF as the
 *      positioner element, so the list renders in the dialog's flow instead
 *      of floating over it in a second portal — which is what makes the
 *      panel one surface and one scroll container.
 *   2. Base UI walks `positionerElement.closest('[role="dialog"]')` to find
 *      the animated element. Our panel is a `Dialog.Popup`, so it matches.
 *   3. `useDismiss` is DISABLED and Escape is allowed to bubble
 *      (`bubbles: inline ? true : undefined`). Without `inline`, the
 *      combobox swallows Escape to close its own popup and the dialog stays
 *      open — one Escape does nothing, and the user is in a surface they
 *      cannot leave from the keyboard (WCAG 2.1.2). This is the failure the
 *      keyboard lock exists to catch.
 *
 * The combobox root is held `open`, controlled, forever. In `inline` mode
 * Base UI already treats the list as open internally, but the input's
 * `aria-controls` is still gated on the root's own `open` state — so leaving
 * it `false` ships a `role="combobox"` that points at nothing.
 *
 * ## Anatomy
 *
 *   CommandPalette (Root)                    → Dialog.Root (open state)
 *     ├─ CommandPaletteTrigger               → Dialog.Trigger (optional)
 *     └─ CommandPaletteContent               → Dialog portal + backdrop +
 *         │                                    popup, wrapping an inline
 *         │                                    Combobox.Root
 *         ├─ CommandPaletteInput             (the search field — no border;
 *         │                                    the panel is the field's box)
 *         ├─ CommandPaletteEmpty
 *         └─ CommandPaletteList
 *             ├─ CommandPaletteGroup → CommandPaletteGroupLabel
 *             ├─ CommandPaletteItem → CommandPaletteShortcut
 *             └─ CommandPaletteSeparator
 *
 * ## Keyboard contract
 *
 * A command palette IS its keyboard model; axe cannot press a key, so every
 * row below is asserted in `CommandPalette.stories.tsx` (`KeyboardFlow`) and
 * the story's existence is locked by `overlay-nav-keyboard-lock.test.ts`.
 *
 * | Key            | Action                                                    |
 * | -------------- | --------------------------------------------------------- |
 * | ⌘K / Ctrl+K    | Open. Not bound here — `useCommandPaletteHotkey` binds it, |
 * |                | opt-in, because a DS may not seize a global chord          |
 * | (on open)      | Focus lands in the input. Dialog's default initial focus   |
 * |                | is the first tabbable element, and that is the input       |
 * | a–z            | Filter. No "search" button exists or should               |
 * | ↓ / ↑          | Move the highlight, wrapping at both ends                  |
 * | Enter          | Run the highlighted command                                |
 * | Esc            | Close the palette and restore focus to whatever opened it  |
 * | Tab            | Trapped inside the panel — the page behind is inert        |
 *
 * FOCUS STAYS IN THE INPUT. Base UI runs list navigation with
 * `virtual: true`: the highlighted row is published via
 * `aria-activedescendant` and `document.activeElement` never becomes an
 * option. Asserting `activeElement.role === 'option'` — correct for `Select`
 * — asserts a bug here.
 *
 * HOME / END MOVE THE CARET, not the highlight. Base UI stops those keys on
 * the input. There is no keyboard route to "last item" other than ↑ from the
 * top, which the wrap makes one keystroke.
 *
 * ## MIN_VIEWPORT — 320
 *
 * The panel is `w-full max-w-[calc(100%-2rem)]` with a `40rem` cap above the
 * `sm` breakpoint, so at 320px it is a full-bleed card with the 16px gutter
 * intact. The list is capped at `max-h-80` and scrolls; the input stays
 * pinned above it, so the field is never pushed off a short viewport by a
 * long result set.
 *
 * ## Contrast (verified by token math)
 *
 * | Composite                                            | Light   | Dark    | Floor           |
 * | ---------------------------------------------------- | ------- | ------- | --------------- |
 * | `text-foreground` on `--background` (panel)          | 19.65:1 | 15.71:1 | 4.5:1 (SC 1.4.3)|
 * | `placeholder:text-muted-foreground` on `--background`| 9.41:1  | 8.74:1  | 4.5:1 (SC 1.4.3)|
 * | highlighted `text-accent-foreground` on `--accent`   | 8.98:1  | 10.46:1 | 4.5:1 (SC 1.4.3)|
 * | group label `text-muted-foreground` on `--background`| 9.41:1  | 8.74:1  | 4.5:1 (SC 1.4.3)|
 * | `focus-visible:ring-ring/60` on `--background`       | 3.23:1  | 4.73:1  | 3:1 (SC 2.4.13) |
 *
 * The input adds no ring of its own — it inherits the DS-wide
 * `:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px }`
 * from `styles/preflight.css`. It is deliberately NOT suppressed even
 * though the input is the only tab stop and holds focus for the whole life
 * of the panel: SC 2.4.7 asks for a visible indicator on a focusable
 * element, and "there is nowhere else for focus to be" is not one of the
 * exceptions. What the palette must not do is stack a SECOND indicator on
 * top, so no `ring-*` is added here.
 *
 * The indicator that carries the navigation state is the ROW highlight —
 * `bg-accent` at 8.98:1 / 10.46:1, well over the 3:1 of SC 2.4.13, and
 * paired with `aria-activedescendant` rather than left to colour alone.
 *
 * `bg-black/50` on the backdrop is inherited from `DialogOverlay` and is
 * intentionally not a token — a scrim must darken the page in BOTH themes.
 *
 * | Rule | Concept                          | Where in this file                                          |
 * | ---- | -------------------------------- | ----------------------------------------------------------- |
 * | R4   | Extends Base UI part props       | each wrapper extends its Base UI part's props               |
 * | R6   | data-slot per part               | `command-palette-content` / `-input` / `-item` / …          |
 * | R7   | className merged + ...rest       | `cn(BASE, className)` + `{...props}` on every part          |
 * | R11  | Composition over prop-drilling   | commands are children; only `items` is a prop, because      |
 * |      |                                  | Base UI needs the array to filter                           |
 * | R12  | Reuse over wrap                  | `Dialog` for the modal, Base UI for the list — no fork      |
 * | R13  | Build with the ecosystem         | `@base-ui/react/combobox` + our own `dialog.tsx`            |
 * | R14  | Controlled + uncontrolled        | `open` / `onOpenChange` / `defaultOpen` from `Dialog.Root`  |
 * | R17  | API parity with shadcn           | mirrors `CommandDialog` part names                          |
 * | R18  | Tailwind only                    | zero inline `style`                                         |
 * | R19  | Tokens only                      | semantic colour tokens throughout — no raw hex              |
 * | R20  | AA contrast                      | table above — every composite measured                      |
 * | R25  | Client component                 | required — Dialog and Combobox both ship client hooks       |
 * | R26  | A11y from upstream               | dialog ARIA + combobox/listbox ARIA + keyboard model        |
 */

import * as React from 'react';
import {
  Combobox as BaseCombobox,
  type ComboboxRootProps,
} from '@base-ui/react/combobox';
import { SearchIcon } from 'lucide-react';

import { cn } from '../lib/cn.js';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from './dialog.js';

/** Smallest viable viewport (CSS px) for this primitive. */
export const MIN_VIEWPORT = 320 as const;

/** Root — `Dialog.Root`, holding only the open state. Renders no DOM. */
const CommandPalette = Dialog;
const CommandPaletteTrigger = DialogTrigger;
/** Required for ARIA labelling of the modal. Usually visually hidden. */
const CommandPaletteTitle = DialogTitle;
const CommandPaletteDescription = DialogDescription;

interface CommandPaletteContentProps<Value>
  extends Omit<
    ComboboxRootProps<Value, false>,
    'inline' | 'open' | 'defaultOpen' | 'onOpenChange' | 'modal'
  > {
  /** Override the panel className (width, offset, padding). */
  className?: string;
  children?: React.ReactNode;
  /**
   * Close the palette once a command is chosen. Default `true` — it is what
   * every ⌘K surface does, and leaving it to the call site breaks the
   * uncontrolled case entirely (there is no `setOpen` to call).
   *
   * Set `false` for a palette that stays open across several commands, e.g.
   * a filter builder.
   */
  closeOnSelect?: boolean;
}

/**
 * The panel: dialog portal → backdrop → popup, wrapping the inline combobox.
 *
 * Built on `DialogContent` rather than on `Dialog.Popup` so the palette
 * inherits one set of overlay decisions (portal target, backdrop opacity,
 * enter/exit transition) instead of a second copy that drifts. The className
 * overrides are deliberate and few — `top`/`translate-y` to dock the panel
 * near the top of the viewport where a palette belongs, `p-0` because the
 * input and the list own their own padding, and the width cap. Everything
 * else, including `role="dialog"` (which the inline combobox looks for),
 * comes from `DialogContent` unchanged.
 */
function CommandPaletteContent<Value>({
  className,
  children,
  closeOnSelect = true,
  onValueChange,
  ...props
}: CommandPaletteContentProps<Value>) {
  /**
   * Closing goes through a real `DialogClose` that we click, not through a
   * `setOpen` we own.
   *
   * The alternative — lifting the open state into a wrapper root so this part
   * could call `setOpen(false)` — means synthesising Base UI's
   * `eventDetails`, which is internal, and re-implementing the
   * controlled/uncontrolled fork that `Dialog.Root` already gets right. A
   * hidden close button routes through Base UI's own close path instead, so
   * `onOpenChange` fires with a real reason and focus returns to the trigger
   * exactly as it does for Escape.
   */
  const closeRef = React.useRef<HTMLButtonElement>(null);

  type ValueChange = NonNullable<ComboboxRootProps<Value, false>['onValueChange']>;
  const handleValueChange: ValueChange = (value, eventDetails) => {
    onValueChange?.(value, eventDetails);
    if (closeOnSelect) closeRef.current?.click();
  };

  return (
    <DialogContent
      showCloseButton={false}
      data-slot="command-palette-content"
      data-min-viewport={String(MIN_VIEWPORT)}
      className={cn(
        'top-[12vh] block translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-[40rem]',
        className,
      )}
    >
      {/*
        `open` is pinned true and uncontrollable. See the header: in `inline`
        mode Base UI treats the list as open regardless, but the input's
        `aria-controls` is gated on this flag — leaving it false ships a
        `role="combobox"` that references no listbox.
      */}
      <BaseCombobox.Root
        inline
        open
        onValueChange={handleValueChange}
        {...(props as ComboboxRootProps<Value, false>)}
      >
        {children}
      </BaseCombobox.Root>
      {/*
        Never focusable, never announced — it exists only so `handleValueChange`
        has a Base UI close path to invoke. `hidden` keeps it out of layout
        while leaving `.click()` working.
      */}
      <DialogClose ref={closeRef} hidden aria-hidden="true" tabIndex={-1} />
    </DialogContent>
  );
}

/**
 * The search field. Borderless on purpose: the dialog panel is the field's
 * visual box, and a second border inside it reads as a nested control.
 * The separator under it is the affordance that says "type here, results
 * below".
 */
function CommandPaletteInput({
  className,
  ...props
}: React.ComponentProps<typeof BaseCombobox.Input>) {
  return (
    <div
      data-slot="command-palette-input-wrapper"
      className="border-border flex h-12 items-center gap-2 border-b px-3"
    >
      <SearchIcon
        aria-hidden="true"
        className="text-muted-foreground size-4 shrink-0"
      />
      <BaseCombobox.Input
        data-slot="command-palette-input"
        className={cn(
          // `h-10` inside the `h-12` row, not `h-full`: the DS focus ring is
          // `outline: 2px` at `outline-offset: 2px`, so it needs 4px of
          // clearance on each side. At `h-full` the panel's `overflow-hidden`
          // shears the top of the ring off — a 2px clip that reads as a
          // rendering glitch and cannot be seen in jsdom, where every box is
          // 0×0. Measured in Chromium.
          'placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground h-10 w-full min-w-0 bg-transparent text-base outline-none md:text-sm',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      />
    </div>
  );
}

function CommandPaletteList({
  className,
  ...props
}: React.ComponentProps<typeof BaseCombobox.List>) {
  return (
    <BaseCombobox.List
      data-slot="command-palette-list"
      className={cn(
        'flex max-h-80 flex-col overflow-x-hidden overflow-y-auto p-1 outline-none',
        className,
      )}
      {...props}
    />
  );
}

function CommandPaletteItem({
  className,
  ...props
}: React.ComponentProps<typeof BaseCombobox.Item>) {
  return (
    <BaseCombobox.Item
      data-slot="command-palette-item"
      className={cn(
        // 40px tall — over the 24px floor of SC 2.5.8, and comfortable for a
        // surface the user drives at speed.
        'text-foreground relative flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-sm transition-colors duration-150 outline-hidden select-none',
        'data-highlighted:bg-accent data-highlighted:text-accent-foreground',
        'data-disabled:pointer-events-none data-disabled:opacity-50',
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    />
  );
}

function CommandPaletteGroup({
  className,
  ...props
}: React.ComponentProps<typeof BaseCombobox.Group>) {
  return (
    <BaseCombobox.Group
      data-slot="command-palette-group"
      className={cn('flex flex-col', className)}
      {...props}
    />
  );
}

function CommandPaletteGroupLabel({
  className,
  ...props
}: React.ComponentProps<typeof BaseCombobox.GroupLabel>) {
  return (
    <BaseCombobox.GroupLabel
      data-slot="command-palette-group-label"
      className={cn(
        'text-muted-foreground px-3 pt-3 pb-1.5 text-xs font-medium',
        className,
      )}
      {...props}
    />
  );
}

/**
 * `empty:py-0` for the reason spelled out in `combobox.tsx`: Base UI keeps
 * this `role="status"` live region mounted and only drops its children, so
 * `py-10` otherwise reserves an 80px dead band between the search field and
 * the first result. Collapsing the padding rather than hiding the element
 * keeps the region in the accessibility tree, which is what makes the
 * "no matching command" announcement land.
 */
function CommandPaletteEmpty({
  className,
  ...props
}: React.ComponentProps<typeof BaseCombobox.Empty>) {
  return (
    <BaseCombobox.Empty
      data-slot="command-palette-empty"
      className={cn(
        'text-muted-foreground px-3 py-10 text-center text-sm empty:py-0',
        className,
      )}
      {...props}
    />
  );
}

function CommandPaletteSeparator({
  className,
  ...props
}: React.ComponentProps<typeof BaseCombobox.Separator>) {
  return (
    <BaseCombobox.Separator
      data-slot="command-palette-separator"
      className={cn('bg-border pointer-events-none -mx-1 my-1 h-px', className)}
      {...props}
    />
  );
}

/** The trailing ⌘K-style hint on a row. Decorative — never the only cue. */
function CommandPaletteShortcut({
  className,
  ...props
}: React.ComponentProps<'kbd'>) {
  return (
    <kbd
      data-slot="command-palette-shortcut"
      className={cn(
        'text-muted-foreground ms-auto font-sans text-xs tracking-widest',
        className,
      )}
      {...props}
    />
  );
}

/**
 * Renders filtered rows. Re-exported under the palette's own name so a
 * consumer composing groups never has to import from `combobox` as well.
 */
const CommandPaletteCollection = BaseCombobox.Collection;

/* ─────────────────────────────────────────────────────────────────
 * useCommandPaletteHotkey — the ⌘K binding, opt-in.
 *
 * Not wired into `CommandPalette` itself. A global chord is an application
 * decision: ⌘K is already "focus the search box" in a dozen apps, and a
 * design system that seizes it on mount takes that choice away from every
 * page that renders a palette. One line at the call site restores it:
 *
 *   useCommandPaletteHotkey(() => setOpen(true));
 *
 * Binds on `document` with the platform-correct modifier (⌘ on Apple, Ctrl
 * elsewhere) and calls `preventDefault()` so the browser's own ⌘K does not
 * also fire.
 * ──────────────────────────────────────────────────────────────── */
interface CommandPaletteHotkeyOptions {
  /** The letter, lower-case. Default `'k'`. */
  key?: string;
  /** Set false to unbind without unmounting the component. Default true. */
  enabled?: boolean;
}

function useCommandPaletteHotkey(
  onTrigger: () => void,
  options: CommandPaletteHotkeyOptions = {},
): void {
  const { key = 'k', enabled = true } = options;
  // Kept in a ref so a call-site arrow function doesn't rebind the listener
  // on every render — the listener would otherwise be removed and re-added
  // between a keydown and its default being prevented.
  const handlerRef = React.useRef(onTrigger);
  React.useEffect(() => {
    handlerRef.current = onTrigger;
  }, [onTrigger]);

  React.useEffect(() => {
    if (!enabled) return undefined;
    function onKeyDown(event: KeyboardEvent) {
      // Either modifier: `metaKey` is ⌘ on Apple platforms, `ctrlKey`
      // everywhere else. Testing both avoids a `navigator.platform` sniff,
      // which is deprecated and wrong under emulation anyway.
      if (event.key.toLowerCase() !== key || !(event.metaKey || event.ctrlKey)) {
        return;
      }
      event.preventDefault();
      handlerRef.current();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [key, enabled]);
}

export {
  CommandPalette,
  CommandPaletteCollection,
  CommandPaletteContent,
  CommandPaletteDescription,
  CommandPaletteEmpty,
  CommandPaletteGroup,
  CommandPaletteGroupLabel,
  CommandPaletteInput,
  CommandPaletteItem,
  CommandPaletteList,
  CommandPaletteSeparator,
  CommandPaletteShortcut,
  CommandPaletteTitle,
  CommandPaletteTrigger,
  useCommandPaletteHotkey,
};
export type { CommandPaletteContentProps, CommandPaletteHotkeyOptions };
