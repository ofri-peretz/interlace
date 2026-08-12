/**
 * Combobox + CommandPalette — runtime keyboard model.
 *
 * WHY THIS FILE EXISTS AT ALL
 * ---------------------------
 * The sibling `combobox-command-keyboard-lock` is a static parser: it proves
 * the contract is WRITTEN DOWN and that a story drives it. It cannot prove
 * the contract HOLDS. The Storybook `play` functions can, but they run in the
 * separate `test-storybook:ci` job against a real browser — so between two
 * green vitest runs, `inline` could be dropped from the palette and this
 * package would not notice.
 *
 * So the two assertions that decide whether a command palette is usable are
 * made here, in jsdom, at `npx vitest run` speed:
 *
 *   1. Escape closes the palette. Without `inline`, Base UI's `useDismiss`
 *      intercepts Escape for a popup that is not there and the dialog stays
 *      open — a keyboard trap (WCAG 2.1.2) that no screenshot and no axe pass
 *      can see.
 *   2. Type → ArrowDown → Enter runs the highlighted command, and DOM focus
 *      never leaves the input while it happens (Base UI navigates virtually
 *      via `aria-activedescendant`).
 *
 * WHAT jsdom CANNOT VERIFY HERE
 * -----------------------------
 * Anything geometric. Every box measures 0×0, so the popup's placement, the
 * 320px floor, the 24px target sizes and the focus-ring contrast are NOT
 * proven by this file — those live in the Storybook stories and the contrast
 * table in the source. Read the assertions below as "the state machine is
 * wired", never as "the component looks right".
 *
 * THE SHIMS
 * ---------
 * jsdom implements neither `ResizeObserver` (Base UI's floating-ui
 * `autoUpdate` subscribes to it) nor `PointerEvent` (Base UI constructs one
 * on activation). Both are shimmed in-file, the same posture as
 * `data-table.test.tsx` — a shim in the test file is visible to the next
 * reader in a way that a global setup file is not.
 */

import * as React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverShim {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  globalThis.ResizeObserver =
    ResizeObserverShim as unknown as typeof ResizeObserver;
}

if (typeof globalThis.PointerEvent === 'undefined') {
  class PointerEventShim extends MouseEvent {
    readonly pointerId: number;
    readonly pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
      this.pointerType = init.pointerType ?? 'mouse';
    }
  }
  globalThis.PointerEvent = PointerEventShim as unknown as typeof PointerEvent;
}

import {
  Combobox,
  ComboboxContent,
  ComboboxControl,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '../src/primitives/combobox.js';
import {
  CommandPalette,
  CommandPaletteContent,
  CommandPaletteEmpty,
  CommandPaletteInput,
  CommandPaletteItem,
  CommandPaletteList,
  CommandPaletteTitle,
  CommandPaletteTrigger,
  useCommandPaletteHotkey,
} from '../src/primitives/command-palette.js';

afterEach(cleanup);

interface Item {
  value: string;
  label: string;
}

const ITEMS: Item[] = [
  { value: 'jwt', label: 'eslint-plugin-jwt' },
  { value: 'crypto', label: 'eslint-plugin-crypto' },
  { value: 'nestjs', label: 'eslint-plugin-nestjs' },
];

/* ── Combobox ───────────────────────────────────────────────────────────── */

function TestCombobox(props: { onValueChange?: (v: Item | null) => void }) {
  return (
    <Combobox items={ITEMS} onValueChange={props.onValueChange}>
      <ComboboxControl>
        <ComboboxInput aria-label="Plugin" placeholder="Search…" />
      </ComboboxControl>
      <ComboboxContent>
        <ComboboxEmpty>No results.</ComboboxEmpty>
        <ComboboxList>
          {(item: Item) => (
            <ComboboxItem key={item.value} value={item}>
              {item.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

describe('Combobox', () => {
  it('renders a combobox input that advertises the listbox it owns', async () => {
    render(<TestCombobox />);
    const input = screen.getByRole('combobox', { name: 'Plugin' });
    expect(input.tagName).toBe('INPUT');
    expect(input.getAttribute('aria-haspopup')).toBe('listbox');
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(input.getAttribute('aria-autocomplete')).toBe('list');
    expect(input.getAttribute('data-slot')).toBe('combobox-input');
    expect(input.getAttribute('data-min-viewport')).toBe('320');
  });

  it('filters as the user types, and only the matches are options', async () => {
    const user = userEvent.setup();
    render(<TestCombobox />);
    const input = screen.getByRole('combobox', { name: 'Plugin' });

    await user.click(input);
    await user.keyboard('jwt');

    await waitFor(() => {
      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(1);
      expect(options[0].textContent).toContain('eslint-plugin-jwt');
    });
  });

  it('highlights with ArrowDown WITHOUT moving DOM focus off the input', async () => {
    const user = userEvent.setup();
    render(<TestCombobox />);
    const input = screen.getByRole('combobox', { name: 'Plugin' });

    await user.click(input);
    await user.keyboard('eslint');
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(3));
    await user.keyboard('{ArrowDown}');

    await waitFor(() => {
      const active = input.getAttribute('aria-activedescendant');
      expect(active).toBeTruthy();
      expect(document.getElementById(active!)?.getAttribute('role')).toBe(
        'option',
      );
    });
    // The line that separates a combobox from a listbox. `Select` moves real
    // focus onto the option; this must not.
    expect(document.activeElement).toBe(input);
  });

  it('commits the highlighted item on Enter', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<TestCombobox onValueChange={onValueChange} />);
    const input = screen.getByRole('combobox', { name: 'Plugin' });

    await user.click(input);
    await user.keyboard('crypto');
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(1));
    await user.keyboard('{ArrowDown}{Enter}');

    await waitFor(() =>
      expect(onValueChange).toHaveBeenCalledWith(
        expect.objectContaining({ value: 'crypto' }),
        expect.anything(),
      ),
    );
    expect((input as HTMLInputElement).value).toBe('eslint-plugin-crypto');
  });

  it('renders the empty state when nothing matches', async () => {
    const user = userEvent.setup();
    render(<TestCombobox />);
    const input = screen.getByRole('combobox', { name: 'Plugin' });

    await user.click(input);
    await user.keyboard('zzzz');

    await waitFor(() => expect(screen.getByText('No results.')).toBeTruthy());
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });
});

/* ── CommandPalette ─────────────────────────────────────────────────────── */

function TestPalette(props: { onValueChange?: (v: Item | null) => void }) {
  return (
    <CommandPalette>
      <CommandPaletteTrigger>Open palette</CommandPaletteTrigger>
      <CommandPaletteContent items={ITEMS} onValueChange={props.onValueChange}>
        <CommandPaletteTitle>Command palette</CommandPaletteTitle>
        <CommandPaletteInput placeholder="Type a command…" />
        <CommandPaletteEmpty>No matching command.</CommandPaletteEmpty>
        <CommandPaletteList>
          {(item: Item) => (
            <CommandPaletteItem key={item.value} value={item}>
              {item.label}
            </CommandPaletteItem>
          )}
        </CommandPaletteList>
      </CommandPaletteContent>
    </CommandPalette>
  );
}

describe('CommandPalette', () => {
  it('is a dialog holding a combobox wired to a listbox', async () => {
    const user = userEvent.setup();
    render(<TestPalette />);

    await user.click(screen.getByRole('button', { name: 'Open palette' }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());

    const input = screen.getByRole('combobox');
    // The `open` pin on the inline root exists for exactly this attribute —
    // an unpinned root ships a role=combobox pointing at nothing.
    await waitFor(() => {
      const controls = input.getAttribute('aria-controls');
      expect(controls).toBeTruthy();
      expect(document.getElementById(controls!)?.getAttribute('role')).toBe(
        'listbox',
      );
    });
  });

  it('puts focus in the search input when it opens', async () => {
    const user = userEvent.setup();
    render(<TestPalette />);

    await user.click(screen.getByRole('button', { name: 'Open palette' }));
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('combobox')),
    );
  });

  it('runs the highlighted command on Enter and closes', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<TestPalette onValueChange={onValueChange} />);

    await user.click(screen.getByRole('button', { name: 'Open palette' }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
    const input = screen.getByRole('combobox');
    // Dialog moves focus in an effect after mount; typing before it lands
    // sends the keystrokes to <body> and the list never filters.
    await waitFor(() => expect(document.activeElement).toBe(input));

    await user.keyboard('nestjs');
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(1));
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(input);
    await user.keyboard('{Enter}');

    await waitFor(() =>
      expect(onValueChange).toHaveBeenCalledWith(
        expect.objectContaining({ value: 'nestjs' }),
        expect.anything(),
      ),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('closes on Escape — the assertion `inline` exists for', async () => {
    const user = userEvent.setup();
    render(<TestPalette />);

    await user.click(screen.getByRole('button', { name: 'Open palette' }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
    // A query first, so Escape has a combobox reason to swallow. Without
    // `inline` this is where the trap appears: the combobox eats the key and
    // the dialog survives.
    await user.keyboard('jwt');
    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('restores focus to the trigger on close', async () => {
    const user = userEvent.setup();
    render(<TestPalette />);
    const trigger = screen.getByRole('button', { name: 'Open palette' });

    await user.click(trigger);
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});

/* ── useCommandPaletteHotkey ────────────────────────────────────────────── */

function HotkeyHarness({
  onTrigger,
  hotkey,
  enabled,
}: {
  onTrigger: () => void;
  hotkey?: string;
  enabled?: boolean;
}) {
  useCommandPaletteHotkey(onTrigger, { key: hotkey, enabled });
  return <div data-testid="harness" />;
}

describe('useCommandPaletteHotkey', () => {
  const press = (init: KeyboardEventInit) => {
    const event = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      ...init,
    });
    document.dispatchEvent(event);
    return event;
  };

  it('fires on Meta+K and prevents the browser default', () => {
    const onTrigger = vi.fn();
    render(<HotkeyHarness onTrigger={onTrigger} />);
    const event = press({ key: 'k', metaKey: true });
    expect(onTrigger).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('fires on Ctrl+K too — no platform sniff', () => {
    const onTrigger = vi.fn();
    render(<HotkeyHarness onTrigger={onTrigger} />);
    press({ key: 'k', ctrlKey: true });
    expect(onTrigger).toHaveBeenCalledTimes(1);
  });

  it('is case-insensitive, so Shift+⌘+K still opens it', () => {
    const onTrigger = vi.fn();
    render(<HotkeyHarness onTrigger={onTrigger} />);
    press({ key: 'K', metaKey: true, shiftKey: true });
    expect(onTrigger).toHaveBeenCalledTimes(1);
  });

  it('ignores the bare letter — a palette must not steal typing', () => {
    const onTrigger = vi.fn();
    render(<HotkeyHarness onTrigger={onTrigger} />);
    const event = press({ key: 'k' });
    expect(onTrigger).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('ignores a different letter with the modifier held', () => {
    const onTrigger = vi.fn();
    render(<HotkeyHarness onTrigger={onTrigger} />);
    press({ key: 'j', metaKey: true });
    expect(onTrigger).not.toHaveBeenCalled();
  });

  it('honours a custom key', () => {
    const onTrigger = vi.fn();
    render(<HotkeyHarness onTrigger={onTrigger} hotkey="p" />);
    press({ key: 'p', metaKey: true });
    press({ key: 'k', metaKey: true });
    expect(onTrigger).toHaveBeenCalledTimes(1);
  });

  it('binds nothing when disabled', () => {
    const onTrigger = vi.fn();
    render(<HotkeyHarness onTrigger={onTrigger} enabled={false} />);
    const event = press({ key: 'k', metaKey: true });
    expect(onTrigger).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('unbinds on unmount', () => {
    const onTrigger = vi.fn();
    const { unmount } = render(<HotkeyHarness onTrigger={onTrigger} />);
    unmount();
    press({ key: 'k', metaKey: true });
    expect(onTrigger).not.toHaveBeenCalled();
  });

  it('calls the latest handler without rebinding the listener', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<HotkeyHarness onTrigger={first} />);
    rerender(<HotkeyHarness onTrigger={second} />);
    press({ key: 'k', metaKey: true });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
