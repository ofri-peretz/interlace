import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within, waitFor } from 'storybook/test';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@interlace/ui/popover';
import { Button } from '@interlace/ui/button';
import { Label } from '@interlace/ui/label';
import { Input } from '@interlace/ui/input';
import { withReducedMotion, withRtl } from '@/decorators';

/**
 * `Popover` is Base UI's `Popover.Root` — a logical container with no DOM, so
 * its own API is the open state plus `modal`. `side` / `align` / `sideOffset`
 * and the popup className live on `PopoverContent` (which bundles
 * Portal + Positioner + Popup) and are surfaced here as story args because
 * placement is the decision a consumer actually makes.
 */
type PopoverStoryArgs = React.ComponentProps<typeof Popover> & {
  side: 'top' | 'right' | 'bottom' | 'left' | 'inline-start' | 'inline-end';
  align: 'start' | 'center' | 'end';
  sideOffset: number;
  contentClassName: string;
};

const meta: Meta<PopoverStoryArgs> = {
  title: 'Primitives/Popover',
  component: Popover,
  subcomponents: { PopoverContent },
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A trigger-anchored panel that opens on a deliberate press and can hold real interactive content — filters, a date range, a small form. Lighter than `Dialog`: no scrim and no focus trap unless you ask for one via `modal`, so the page behind stays usable. Use `Tooltip` instead when the content is a short non-interactive label, and `HoverCard` when the disclosure should follow the pointer; escalate to `Dialog` once the task deserves the user\'s whole attention.',
      },
    },
  },
  argTypes: {
    open: {
      control: 'boolean',
      description:
        'Controlled open state. Leave it `undefined` to let the trigger own it — setting it pins the popover and the trigger can no longer close it.',
      table: { category: 'State' },
    },
    defaultOpen: {
      control: 'boolean',
      description: 'Uncontrolled initial state. Ignored while `open` is set.',
      table: { category: 'State', defaultValue: { summary: 'false' } },
    },
    modal: {
      control: 'select',
      options: [false, true, 'trap-focus'],
      description:
        '`false` leaves the rest of the page interactive. `true` locks page scroll and blocks outside pointer interaction. `"trap-focus"` traps focus only — the compromise for a panel with a long form that must not leak Tab into the page behind it.',
      table: {
        category: 'Behaviour',
        type: { summary: "boolean | 'trap-focus'" },
        defaultValue: { summary: 'false' },
      },
    },
    onOpenChange: {
      action: 'openChange',
      description:
        'Fires with `(open, eventDetails)`; `eventDetails.reason` distinguishes `trigger-press` from `outside-press`, `escape-key` and `close-press`.',
      table: { category: 'Events' },
    },
    onOpenChangeComplete: {
      action: 'openChangeComplete',
      description: 'Fires after the open/close animation has finished.',
      table: { category: 'Events' },
    },
    side: {
      control: 'select',
      options: ['top', 'right', 'bottom', 'left', 'inline-start', 'inline-end'],
      description:
        'Preferred edge of the trigger to open against — a `PopoverContent` prop. Flips automatically on collision.',
      table: {
        category: 'Content (positioning)',
        type: { summary: "'top' | 'right' | 'bottom' | 'left' | …" },
        defaultValue: { summary: 'bottom' },
      },
    },
    align: {
      control: 'select',
      options: ['start', 'center', 'end'],
      description: 'Alignment along the chosen side — a `PopoverContent` prop.',
      table: {
        category: 'Content (positioning)',
        defaultValue: { summary: 'center' },
      },
    },
    sideOffset: {
      control: { type: 'range', min: 0, max: 32, step: 1 },
      description:
        'Gap in pixels between trigger and popup — a `PopoverContent` prop.',
      table: {
        category: 'Content (positioning)',
        defaultValue: { summary: '4' },
      },
    },
    contentClassName: {
      control: 'text',
      description:
        'STORY ARG — lands on `PopoverContent`\'s `className`. The popup is `w-72` by default; this is the width seam.',
      table: { category: 'Content (positioning)' },
    },
    children: {
      control: false,
      description: 'The `PopoverTrigger` and `PopoverContent` pair.',
      table: { category: 'Slots', type: { summary: 'ReactNode' } },
    },
  },
  args: {
    defaultOpen: false,
    modal: false,
    side: 'bottom',
    align: 'center',
    sideOffset: 4,
    contentClassName: 'w-72',
    onOpenChange: fn(),
    onOpenChangeComplete: fn(),
  },
};

export default meta;
type Story = StoryObj<PopoverStoryArgs>;

const DateRangeFields = () => (
  <div className="flex flex-col gap-2">
    <Label htmlFor="from">From</Label>
    <Input id="from" type="date" />
    <Label htmlFor="to">To</Label>
    <Input id="to" type="date" />
  </div>
);

export const Default: Story = {
  render: ({ side, align, sideOffset, contentClassName, ...rootProps }) => (
    <Popover {...rootProps}>
      <PopoverTrigger render={<Button variant="outline" />}>
        Open
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        sideOffset={sideOffset}
        className={contentClassName}
      >
        <DateRangeFields />
      </PopoverContent>
    </Popover>
  ),
};

/**
 * Placement, sampled at the four edges. Base UI flips the popup when the
 * preferred side would collide with the viewport, so `side` is a preference
 * and not a guarantee — which is why the `Default` story exposes it as a
 * control rather than this grid pretending to be exhaustive.
 */
export const Placement: Story = {
  // The registry's thumbnail for this component — see the preview policy in
  // apps/registry/scripts/build-story-map.mjs. Default renders too small to
  // read at thumbnail size.
  tags: ['preview'],
  parameters: { layout: 'padded' },
  render: () => (
    <div className="grid grid-cols-1 gap-2xl p-2xl md:grid-cols-2">
      {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
        <div key={side} className="flex items-center justify-center">
          <Popover>
            <PopoverTrigger render={<Button variant="outline" />}>
              side=&quot;{side}&quot;
            </PopoverTrigger>
            <PopoverContent side={side} className="w-72">
              <DateRangeFields />
            </PopoverContent>
          </Popover>
        </div>
      ))}
    </div>
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
  ...Placement,
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
