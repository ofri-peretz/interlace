import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within, waitFor } from 'storybook/test';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@interlace/ui/tooltip';
import { Button } from '@interlace/ui/button';
import { withDark, withReducedMotion, withRtl } from '@/decorators';

const meta: Meta<typeof Tooltip> = {
  title: 'Primitives/Tooltip',
  component: Tooltip,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Hover/focus-only hint. Never wrap interactive content — tooltips disappear on blur. The fade transition is killed under `prefers-reduced-motion` (see `ReducedMotion` story).',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Tooltip>;

export const Default: Story = {
  render: () => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger render={<Button variant="outline" />}>
          Hover or focus me
        </TooltipTrigger>
        <TooltipContent>Sort direction (asc/desc)</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ),
};

/**
 * Keyboard-only flow: a tooltip that only opens on hover is invisible to
 * keyboard and touch users. This asserts focus alone reveals it and Escape
 * dismisses it (WCAG 2.2 §1.4.13 Content on Hover or Focus).
 */
export const KeyboardFlow: Story = {
  render: () => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger render={<Button>Sort</Button>} />
        <TooltipContent>Sort direction (asc/desc)</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ),
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: /sort/i });

    await step('Focus alone reveals the tooltip', async () => {
      trigger.focus();
      await waitFor(() =>
        expect(
          document.querySelector('[data-slot="tooltip-content"]'),
        ).toBeTruthy(),
      );
    });

    await step('Escape dismisses it without moving focus', async () => {
      await userEvent.keyboard('{Escape}');
      await waitFor(() =>
        expect(
          document.querySelector('[data-slot="tooltip-content"]'),
        ).toBeFalsy(),
      );
      expect(document.activeElement).toBe(trigger);
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
