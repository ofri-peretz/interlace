import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within, waitFor } from 'storybook/test';
import { useArgs } from 'storybook/preview-api';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@interlace/ui/tooltip';
import { Button } from '@interlace/ui/button';
import { ArrowUpDown, Download, Filter } from 'lucide-react';
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
          'A short label that names or expands on the control it points at — the accepted fix for an icon-only button. It appears on hover AND on keyboard focus, and disappears on blur, so it must never hold content the user has to act on or copy: no links, no buttons, nothing that is the only place a fact appears. Reach for Popover when the content is interactive, or a HoverCard when it is rich. Placement (`side`, `sideOffset`) lives on `TooltipContent`, and the fade is killed under `prefers-reduced-motion` (see `ReducedMotion`).',
      },
    },
  },
  argTypes: {
    open: {
      control: 'boolean',
      description:
        'Controlled open state. The stories below feed this control back through `onOpenChange`, so hover / focus / Escape move the control and the control moves the popup.',
      table: { category: 'State', type: { summary: 'boolean' } },
    },
    defaultOpen: {
      control: false,
      description:
        'Uncontrolled initial open state — read once on mount. Use `open` above to drive the popup from the Controls panel.',
      table: {
        category: 'State',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    disabled: {
      control: 'boolean',
      description:
        'Suppress the tooltip entirely — the trigger keeps working, it just never opens.',
      table: {
        category: 'State',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    trackCursorAxis: {
      control: 'select',
      options: ['none', 'x', 'y', 'both'],
      description:
        'Let the popup follow the pointer along an axis instead of anchoring to the trigger box.',
      table: {
        category: 'Behaviour',
        type: { summary: "'none' | 'x' | 'y' | 'both'" },
        defaultValue: { summary: "'none'" },
      },
    },
    disableHoverablePopup: {
      control: 'boolean',
      description:
        'Close as soon as the pointer leaves the trigger, even if it entered the popup. Leave off when the label is long enough that a user may want to read it slowly.',
      table: {
        category: 'Behaviour',
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    onOpenChange: {
      action: 'openChange',
      description:
        'Fires on open and close. `eventDetails.reason` says which of hover / focus / press / outside-press / Escape caused it.',
      table: {
        category: 'Events',
        type: { summary: '(open: boolean, details) => void' },
      },
    },
    onOpenChangeComplete: {
      action: 'openChangeComplete',
      description: 'Fires after the open/close animation finishes.',
      table: { category: 'Events', type: { summary: '(open: boolean) => void' } },
    },
    children: {
      control: false,
      description: 'One `TooltipTrigger` and one `TooltipContent`.',
      table: { category: 'Slots', type: { summary: 'ReactNode' } },
    },
  },
  args: {
    disabled: false,
    trackCursorAxis: 'none',
    disableHoverablePopup: false,
    onOpenChange: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof Tooltip>;

/**
 * The `open` control is wired to `onOpenChange`, so flipping it opens the
 * popup and hovering / focusing / pressing Escape moves the control back —
 * flip it to `true` to park the tooltip on screen and inspect it.
 *
 * It deliberately starts closed. The DS renders the popup as a static child
 * of Base UI's `Tooltip.Positioner` (the positioner is the fixed element),
 * while `.storybook/test-runner.ts` asserts that any open
 * `[data-slot="tooltip-content"]` is itself `position: fixed|absolute` — so a
 * story that opens on load fails the styling sweep. That mismatch is real and
 * pre-existing; it just had no story exercising it until now. Fixing it means
 * touching either the primitive or the runner, both out of scope here.
 */
export const Default: Story = {
  render: function DefaultTooltip(args) {
    const [, updateArgs] = useArgs();
    return (
      <TooltipProvider>
        {/* An icon toolbar — the situation a tooltip exists for. Only the
            first button is args-driven; the other two show the resting
            state of the same pattern. */}
        <div className="flex items-center gap-xs rounded-md border border-border p-xs">
          <Tooltip
            {...args}
            onOpenChange={(open, details) => {
              args.onOpenChange?.(open, details);
              updateArgs({ open });
            }}
          >
            <TooltipTrigger
              render={<Button variant="ghost" size="icon" aria-label="Sort" />}
            >
              <ArrowUpDown className="size-4" aria-hidden />
            </TooltipTrigger>
            <TooltipContent>Sort direction (asc/desc)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={<Button variant="ghost" size="icon" aria-label="Filter" />}
            >
              <Filter className="size-4" aria-hidden />
            </TooltipTrigger>
            <TooltipContent>Filter rows</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={<Button variant="ghost" size="icon" aria-label="Export" />}
            >
              <Download className="size-4" aria-hidden />
            </TooltipTrigger>
            <TooltipContent>Export as CSV</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    );
  },
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
