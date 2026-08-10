import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within, waitFor } from 'storybook/test';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from '@interlace/ui/context-menu';
import { Skeleton } from '@interlace/ui/skeleton';
import { withDark, withRtl } from '@/decorators';

const meta: Meta<typeof ContextMenu> = {
  title: 'Primitives/ContextMenu',
  component: ContextMenu,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A menu opened by right-click, long-press, or Shift+F10 on the trigger surface. Reach for it only where users already expect an OS-level context affordance — file lists, editor canvases, image grids — and never as the *only* route to an action, since the gesture is undiscoverable. For the ordinary click-a-button-to-open case use `DropdownMenu`. The controls below sit on the root, which owns the open state and the keyboard behaviour of the popup; positioning props (`side`, `align`, `sideOffset`) live on `ContextMenuContent`.',
      },
    },
  },
  argTypes: {
    open: {
      control: 'boolean',
      description:
        'Controlled open state. Setting it at all takes ownership — the right-click gesture then only reports intent through `onOpenChange`.',
      table: { type: { summary: 'boolean' }, category: 'State' },
    },
    defaultOpen: {
      control: 'boolean',
      description:
        'Open on mount, uncontrolled. Rarely right for a context menu: with no pointer event there is no anchor point, so the popup lands wherever the positioner falls back to.',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
        category: 'State',
      },
    },
    disabled: {
      control: 'boolean',
      description: 'Ignore user interaction — the right-click gesture stops opening the menu.',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
        category: 'State',
      },
    },
    orientation: {
      control: 'select',
      options: ['vertical', 'horizontal'],
      description:
        'Which arrow-key axis roves between items. `vertical` binds Up/Down, `horizontal` binds Left/Right.',
      table: {
        type: { summary: "'vertical' | 'horizontal'" },
        defaultValue: { summary: 'vertical' },
        category: 'Behaviour',
      },
    },
    loopFocus: {
      control: 'boolean',
      description:
        'Wrap the roving highlight from the last item back to the first (and vice versa) instead of stopping at the ends.',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'true' },
        category: 'Behaviour',
      },
    },
    highlightItemOnHover: {
      control: 'boolean',
      description:
        'Move the highlight (`data-highlighted`) as the pointer passes over items. Turn it off when you need CSS `:hover` to read differently from keyboard focus.',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'true' },
        category: 'Behaviour',
      },
    },
    closeParentOnEsc: {
      control: 'boolean',
      description:
        'In a submenu, whether Escape dismisses the whole menu tree or only the child menu.',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'true' },
        category: 'Behaviour',
      },
    },
    onOpenChange: {
      action: 'openChange',
      description:
        'Fired when the menu opens or closes. Receives `(open, eventDetails)`; `eventDetails.reason` separates an outside press from Escape from an item press.',
      table: {
        type: { summary: '(open: boolean, details) => void' },
        category: 'Events',
      },
    },
    onOpenChangeComplete: {
      action: 'openChangeComplete',
      description: 'Fired after the open/close animation has finished.',
      table: { type: { summary: '(open: boolean) => void' }, category: 'Events' },
    },
    children: {
      control: false,
      description:
        'One `ContextMenuTrigger` plus one `ContextMenuContent`. `ContextMenuContent` already wraps Portal + Positioner + Popup — do not nest it inside `ContextMenuPortal`.',
      table: { type: { summary: 'ReactNode' }, category: 'Slots' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof ContextMenu>;

const sampleItems = [
  { label: 'Open', onSelect: () => {}, shortcut: '↩' },
  { label: 'Duplicate', onSelect: () => {}, shortcut: '⌘D' },
  { type: 'separator' as const },
  { type: 'label' as const, label: 'Danger zone' },
  {
    label: 'Delete',
    onSelect: () => {},
    tone: 'destructive' as const,
    shortcut: '⌫',
  },
];

/**
 * The compositional API, driven from args so every control on the root moves
 * something. Right-click (or focus the surface and press Shift+F10) to open.
 */
export const Default: Story = {
  args: {
    disabled: false,
    orientation: 'vertical',
    loopFocus: true,
    highlightItemOnHover: true,
    closeParentOnEsc: true,
  },
  render: (args) => (
    <div className="flex h-48 w-80 items-center justify-center">
      <ContextMenu {...args}>
        <ContextMenuTrigger className="border-border bg-card text-card-foreground flex h-32 w-64 items-center justify-center rounded-md border border-dashed">
          Right-click anywhere here
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem>
            Open
            <ContextMenuShortcut>↩</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem>
            Duplicate
            <ContextMenuShortcut>⌘D</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuGroup>
            <ContextMenuLabel>Danger zone</ContextMenuLabel>
            <ContextMenuItem className="text-destructive data-[highlighted]:text-destructive">
              Delete
              <ContextMenuShortcut>⌫</ContextMenuShortcut>
            </ContextMenuItem>
          </ContextMenuGroup>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  ),
};

/**
 * `ContextMenu.Compose` — the same menu from a flat `items` array, for the
 * ~90% of call sites that only need item / separator / label entries. A
 * `label` opens a group that runs until the next label or separator, because
 * Base UI's `GroupLabel` throws when rendered outside a `Group` — a crash
 * that stays invisible until the menu is first opened.
 */
export const Compose: Story = {
  render: () => (
    <div className="flex h-48 w-80 items-center justify-center">
      <ContextMenu.Compose
        trigger={
          <div className="border-border bg-card text-card-foreground flex h-32 w-64 items-center justify-center rounded-md border border-dashed">
            Right-click anywhere here
          </div>
        }
        items={sampleItems}
      />
    </div>
  ),
};

/**
 * Keyboard-only flow. Base UI's ContextMenu opens on `contextmenu` (right
 * click / long press) ONLY — a menu with no keyboard path to open is a WCAG
 * 2.1.1 failure that axe can't see, because the menu isn't in the DOM until
 * a pointer event fires. `ContextMenuTrigger` therefore joins the tab order
 * and synthesises the event on Shift+F10 and on the dedicated Menu key.
 */
export const KeyboardFlow: Story = {
  render: () => (
    <div className="flex h-48 w-80 items-center justify-center">
      <ContextMenu.Compose
        trigger={
          <div className="border-border bg-card text-card-foreground flex h-32 w-64 items-center justify-center rounded-md border border-dashed">
            Focus me, then press Shift+F10
          </div>
        }
        items={sampleItems}
      />
    </div>
  ),
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByText(/press shift\+f10/i);
    const menu = () => document.querySelector('[role="menu"]');

    await step('The trigger is reachable by keyboard at all', async () => {
      expect(trigger.getAttribute('tabindex')).toBe('0');
    });

    await step('Shift+F10 opens the menu from the keyboard', async () => {
      trigger.focus();
      await userEvent.keyboard('{Shift>}{F10}{/Shift}');
      await waitFor(() => expect(menu()).toBeTruthy());
    });

    await step('Arrows rove between items', async () => {
      await userEvent.keyboard('{ArrowDown}');
      await waitFor(() =>
        expect(document.activeElement?.getAttribute('role')).toBe('menuitem'),
      );
      const first = document.activeElement;
      await userEvent.keyboard('{ArrowDown}');
      await waitFor(() => expect(document.activeElement).not.toBe(first));
    });

    await step('Escape closes and restores focus to the trigger', async () => {
      await userEvent.keyboard('{Escape}');
      await waitFor(() => expect(menu()).toBeFalsy());
      await waitFor(() => expect(document.activeElement).toBe(trigger));
    });
  },
};

/**
 * Async menu contents — same popup silhouette as DropdownMenu, so a menu
 * whose items are still resolving reserves its box instead of popping in.
 */
export const Loading: Story = {
  render: () => <Skeleton variant="menu" />,
};

export const Dark: Story = { ...Default, decorators: [withDark] };
export const RTL: Story = { ...Default, decorators: [withRtl] };
