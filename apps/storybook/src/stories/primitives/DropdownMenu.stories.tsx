import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within, waitFor } from 'storybook/test';
import { Skeleton } from '@interlace/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@interlace/ui/dropdown-menu';
import { Button } from '@interlace/ui/button';
import { withDark, withReducedMotion, withRtl } from '@/decorators';

const meta: Meta<typeof DropdownMenu> = {
  title: 'Primitives/DropdownMenu',
  component: DropdownMenu,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Trigger-anchored menu with full keyboard navigation per `KEYBOARD_PHILOSOPHY.md`. Supports items, checkbox-items, radio-items, sub-menus. Closes on Escape or click-outside.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof DropdownMenu>;

export const Default: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" />}>
        Open
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Sort articles</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Latest</DropdownMenuItem>
        <DropdownMenuItem>Popular</DropdownMenuItem>
        <DropdownMenuItem>Most discussed</DropdownMenuItem>
        <DropdownMenuItem>Long reads</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};

/**
 * Keyboard-only flow per the APG menu-button pattern: Enter opens the menu
 * AND puts focus on a menu item, arrows rove, Escape closes and returns
 * focus to the trigger.
 */
export const KeyboardFlow: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button>Sort</Button>} />
      <DropdownMenuContent>
        <DropdownMenuItem>Latest</DropdownMenuItem>
        <DropdownMenuItem>Popular</DropdownMenuItem>
        <DropdownMenuItem>Long reads</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: /sort/i });

    await step('The trigger advertises the menu it owns', async () => {
      // Base UI writes the ARIA pairing in a mount effect.
      await waitFor(() => {
        expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
        expect(trigger.getAttribute('aria-expanded')).toBe('false');
      });
    });

    await step('Enter opens the menu and focuses an item', async () => {
      // Tab to it rather than calling .focus() — userEvent keeps its own
      // notion of the focused element, and a raw focus() call leaves its
      // keyboard dispatch pointed at the document instead of the trigger.
      await userEvent.tab();
      await waitFor(() => expect(document.activeElement).toBe(trigger));
      await userEvent.keyboard('{Enter}');
      await waitFor(() =>
        expect(document.querySelector('[role="menu"]')).toBeTruthy(),
      );
      await waitFor(() =>
        expect(document.activeElement?.getAttribute('role')).toBe('menuitem'),
      );
    });

    await step('ArrowDown roves to the next item', async () => {
      const first = document.activeElement;
      await userEvent.keyboard('{ArrowDown}');
      await waitFor(() => expect(document.activeElement).not.toBe(first));
      expect(document.activeElement?.getAttribute('role')).toBe('menuitem');
    });

    await step('Escape closes and restores focus to the trigger', async () => {
      await userEvent.keyboard('{Escape}');
      await waitFor(() =>
        expect(document.querySelector('[role="menu"]')).toBeFalsy(),
      );
      await waitFor(() => expect(document.activeElement).toBe(trigger));
    });
  },
};

/**
 * Async menu contents — reserve the popup silhouette so opening a menu
 * whose items are still loading doesn't reflow the surface underneath.
 */
export const Loading: Story = {
  render: () => <Skeleton variant="menu" />,
};

export const Dark: Story = {
  ...Default,
  decorators: [withDark],
};

export const RTL: Story = {
  ...Default,
  decorators: [withRtl],
};

export const ReducedMotion: Story = {
  ...Default,
  decorators: [withReducedMotion],
};
