import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within, waitFor } from 'storybook/test';
import { ContextMenu } from '@interlace/ui/context-menu';
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
          'Right-click / long-press menu. Use for true OS-level context affordances (file lists, editor canvases, image grids). For click-to-open menus reach for `DropdownMenu`. Compose API takes a declarative `items` array; for per-part customisation drop to `<ContextMenu>` + `<ContextMenuTrigger>` + `<ContextMenuContent>`.',
      },
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

export const Default: Story = {
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
