import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within, waitFor } from 'storybook/test';
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@interlace/ui/sheet';
import { Button } from '@interlace/ui/button';
import { Badge } from '@interlace/ui/badge';
import { withDark, withReducedMotion, withRtl } from '@/decorators';

const meta: Meta<typeof Sheet> = {
  title: 'Primitives/Sheet',
  component: Sheet,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Side-anchored Dialog variant — top, right, bottom, or left. Inherits Dialog\'s focus trap + Escape-to-close; the slide animation is killed under `prefers-reduced-motion` (see `ReducedMotion`).',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Sheet>;

export const Default: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger render={<Button variant="outline" />}>
        Open
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Filter articles</SheetTitle>
          <SheetDescription>
            Narrow the list by topic, reading time, or recency.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-wrap gap-2 p-4">
          {['security', 'eslint', 'nodejs', 'typescript', 'jwt'].map((t) => (
            <Badge key={t} variant="outline">
              #{t}
            </Badge>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  ),
};

/**
 * Keyboard-only flow: trigger opens with Enter, focus enters the panel,
 * Escape closes it, and focus lands back on the trigger. A drawer that
 * strands focus behind a closed panel is the classic overlay a11y bug.
 */
export const KeyboardFlow: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger render={<Button>Open panel</Button>} />
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription>Keyboard round-trip under test.</SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  ),
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: /open panel/i });

    await step('Enter on the focused trigger opens the sheet', async () => {
      trigger.focus();
      await userEvent.keyboard('{Enter}');
      await waitFor(() =>
        expect(document.querySelector('[role="dialog"]')).toBeTruthy(),
      );
    });

    await step('Panel has an accessible name + focus moved in', async () => {
      const panel = document.querySelector('[role="dialog"]') as HTMLElement;
      expect(panel.getAttribute('aria-labelledby')).toBeTruthy();
      await waitFor(() =>
        expect(panel.contains(document.activeElement)).toBe(true),
      );
    });

    await step('Escape closes and restores focus to the trigger', async () => {
      await userEvent.keyboard('{Escape}');
      await waitFor(() =>
        expect(document.querySelector('[role="dialog"]')).toBeFalsy(),
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
