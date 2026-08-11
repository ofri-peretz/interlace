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
import { withReducedMotion, withRtl } from '@/decorators';

const meta: Meta<typeof DropdownMenu> = {
  title: 'Primitives/DropdownMenu',
  component: DropdownMenu,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A list of actions anchored to the button that opens it. Reach for it when a toolbar has more actions than fit, or when an action needs a short set of options — sort orders, row actions, an account menu. It is a menu of *commands*, not a form control: for choosing a value that gets submitted use `Select`, and for a right-click affordance use `ContextMenu`. Supports items, checkbox-items, radio-items and sub-menus; Escape and click-outside close it and return focus to the trigger, per `KEYBOARD_PHILOSOPHY.md`. The controls below sit on the root; `side`, `align` and `sideOffset` live on `DropdownMenuContent`.',
      },
    },
  },
  argTypes: {
    open: {
      control: 'boolean',
      description:
        'Controlled open state. Setting it at all takes ownership — the trigger then only reports intent through `onOpenChange`.',
      table: { type: { summary: 'boolean' }, category: 'State' },
    },
    defaultOpen: {
      control: 'boolean',
      description:
        'Open on mount, uncontrolled. Flip it here to see the popup without clicking the trigger.',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
        category: 'State',
      },
    },
    disabled: {
      control: 'boolean',
      description: 'Ignore user interaction — the trigger stops opening the menu.',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
        category: 'State',
      },
    },
    modal: {
      control: 'boolean',
      description:
        'When true, page scroll is locked and pointer interaction outside the menu is disabled while it is open. Turn it off for a menu that sits inside a scrollable surface the user should still be able to move.',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'true' },
        category: 'Behaviour',
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
        'Wrap the roving highlight from the last item back to the first instead of stopping at the ends.',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'true' },
        category: 'Behaviour',
      },
    },
    highlightItemOnHover: {
      control: 'boolean',
      description:
        'Move the highlight (`data-highlighted`) as the pointer passes over items. Turn it off when CSS `:hover` needs to read differently from keyboard focus.',
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
        'Fired when the menu opens or closes. Receives `(open, eventDetails)`; `eventDetails.reason` separates an item press from Escape from an outside press.',
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
        'One `DropdownMenuTrigger` plus one `DropdownMenuContent`. `DropdownMenuContent` already renders the Portal and Positioner.',
      table: { type: { summary: 'ReactNode' }, category: 'Slots' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof DropdownMenu>;

/**
 * Shown where a dropdown belongs — at the end of a list toolbar — rather than
 * as a lone button on an empty canvas. Every control in the panel is live:
 * `defaultOpen` reveals the popup without a click, `modal` decides whether the
 * page behind it stays interactive, and `loopFocus` / `orientation` change how
 * the arrow keys rove.
 */
export const Default: Story = {
  args: {
    defaultOpen: false,
    disabled: false,
    modal: true,
    orientation: 'vertical',
    loopFocus: true,
    highlightItemOnHover: true,
    closeParentOnEsc: true,
  },
  render: (args) => (
    <div className="border-border bg-card flex w-[420px] max-w-full items-center justify-between gap-4 rounded-lg border px-4 py-3">
      <div>
        <div className="text-sm font-medium">Articles</div>
        <div className="text-muted-foreground text-sm">128 published</div>
      </div>
      <DropdownMenu {...args}>
        <DropdownMenuTrigger render={<Button variant="outline" />}>
          Sort
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
    </div>
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
  globals: { theme: 'dark' },
};

export const RTL: Story = {
  ...Default,
  decorators: [withRtl],
};

export const ReducedMotion: Story = {
  ...Default,
  decorators: [withReducedMotion],
};
