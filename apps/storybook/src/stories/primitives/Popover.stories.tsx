import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within, waitFor } from 'storybook/test';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@interlace/ui/popover';
import { Button } from '@interlace/ui/button';
import { Label } from '@interlace/ui/label';
import { Input } from '@interlace/ui/input';
import { withDark, withReducedMotion, withRtl } from '@/decorators';

const meta: Meta<typeof Popover> = {
  title: 'Primitives/Popover',
  component: Popover,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Trigger-anchored panel. Lighter than Dialog — no focus trap by default, no scrim. Use for transient inputs, filters, or hover hints with interactivity.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Popover>;

export const Default: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger render={<Button variant="outline" />}>
        Open
      </PopoverTrigger>
      <PopoverContent className="w-72">
        <div className="flex flex-col gap-2">
          <Label htmlFor="from">From</Label>
          <Input id="from" type="date" />
          <Label htmlFor="to">To</Label>
          <Input id="to" type="date" />
        </div>
      </PopoverContent>
    </Popover>
  ),
};

/**
 * Keyboard-only flow: Enter opens the panel, focus moves into it, Escape
 * dismisses and returns focus to the trigger.
 */
export const KeyboardFlow: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger render={<Button>Open filters</Button>} />
      <PopoverContent className="w-72">
        <div className="flex flex-col gap-2">
          <Label htmlFor="kb-from">From</Label>
          <Input id="kb-from" type="date" />
        </div>
      </PopoverContent>
    </Popover>
  ),
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: /open filters/i });

    await step('Enter opens the popover', async () => {
      trigger.focus();
      await userEvent.keyboard('{Enter}');
      await waitFor(() =>
        expect(
          document.querySelector('[data-slot="popover-content"]'),
        ).toBeTruthy(),
      );
    });

    await step('Trigger reports the expanded state', async () => {
      await waitFor(() =>
        expect(trigger.getAttribute('aria-expanded')).toBe('true'),
      );
    });

    await step('Escape closes and restores focus', async () => {
      await userEvent.keyboard('{Escape}');
      await waitFor(() =>
        expect(
          document.querySelector('[data-slot="popover-content"]'),
        ).toBeFalsy(),
      );
      await waitFor(() => expect(document.activeElement).toBe(trigger));
    });
  },
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
