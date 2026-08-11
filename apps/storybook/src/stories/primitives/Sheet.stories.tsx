import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within, waitFor } from 'storybook/test';
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
import { withReducedMotion, withRtl } from '@/decorators';

/**
 * `side` lives on `SheetContent`, not on the root — but it is the prop a
 * reader most wants to flip, so it rides along in the story args and is
 * forwarded by the demo component below.
 */
type SheetStoryArgs = React.ComponentProps<typeof Sheet> & {
  side?: 'top' | 'right' | 'bottom' | 'left';
};

const meta: Meta<SheetStoryArgs> = {
  title: 'Primitives/Sheet',
  component: Sheet,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A Dialog anchored to one edge of the viewport instead of the centre — the shape to use for a nav drawer, a filter panel, or a settings pane that the user should scan alongside the page they came from. The root renders no DOM: it owns the open state for `SheetTrigger` + `SheetContent`, and inherits the Dialog focus trap, scroll lock and Escape-to-close. Use `Dialog` when the task is a decision that must be finished before returning, and `Popover` when the content is a short aside anchored to a control.',
      },
    },
  },
  argTypes: {
    open: {
      control: 'boolean',
      description:
        'Controlled open state. The demo mirrors it into local state so the panel still closes on Escape / backdrop press while the control drives it.',
      table: { type: { summary: 'boolean' }, category: 'State' },
    },
    defaultOpen: {
      control: false,
      description:
        'Uncontrolled initial open state. Use instead of `open` when the consumer does not need to read the state back.',
      table: { type: { summary: 'boolean' }, defaultValue: { summary: 'false' }, category: 'State' },
    },
    modal: {
      control: 'select',
      options: [true, false, 'trap-focus'],
      description:
        '`true` traps focus, locks page scroll and makes the rest of the document inert. `\'trap-focus\'` traps focus only. `false` leaves the page fully interactive — pick it for a persistent side panel.',
      table: {
        type: { summary: "boolean | 'trap-focus'" },
        defaultValue: { summary: 'true' },
        category: 'State',
      },
    },
    disablePointerDismissal: {
      control: 'boolean',
      description:
        'Keep the panel open on a backdrop press. Escape still closes it — never remove both exits.',
      table: { type: { summary: 'boolean' }, defaultValue: { summary: 'false' }, category: 'State' },
    },
    side: {
      control: 'inline-radio',
      options: ['top', 'right', 'bottom', 'left'],
      description:
        'Edge the panel slides in from — a `SheetContent` prop. Left/right are `w-3/4` capped at `sm:max-w-96`; top/bottom are `h-auto`.',
      table: {
        type: { summary: "'top' | 'right' | 'bottom' | 'left'" },
        defaultValue: { summary: 'right' },
        category: 'SheetContent',
      },
    },
    onOpenChange: {
      control: false,
      description:
        'Fired on every open/close with the reason (`triggerPress`, `escapeKey`, `outsidePress`, `closePress`, …) on the event details.',
      table: { type: { summary: '(open, eventDetails) => void' }, category: 'Events' },
    },
    onOpenChangeComplete: {
      control: false,
      description:
        'Fired after the slide animation settles — the hook for restoring scroll position or releasing data.',
      table: { type: { summary: '(open: boolean) => void' }, category: 'Events' },
    },
    children: {
      control: false,
      description: '`SheetTrigger` + `SheetContent` (which itself composes header / body / footer).',
      table: { type: { summary: 'ReactNode' }, category: 'Slots' },
    },
  },
  args: {
    onOpenChange: fn(),
    onOpenChangeComplete: fn(),
  },
};

export default meta;
type Story = StoryObj<SheetStoryArgs>;

const TOPICS = ['security', 'eslint', 'nodejs', 'typescript', 'jwt'];

/**
 * Mirrors the `open` arg into local state so the Controls panel can drive the
 * panel AND the panel can still close itself (Escape, backdrop, close button)
 * — a purely controlled `open` arg would make the sheet impossible to dismiss.
 */
function SheetDemo({ side = 'right', open, onOpenChange, ...rest }: SheetStoryArgs) {
  const [isOpen, setIsOpen] = React.useState(open ?? false);
  React.useEffect(() => {
    setIsOpen(open ?? false);
  }, [open]);

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(next, details) => {
        setIsOpen(next);
        onOpenChange?.(next, details);
      }}
      {...rest}
    >
      <SheetTrigger render={<Button variant="outline" />}>
        Open filters
      </SheetTrigger>
      <SheetContent side={side}>
        <SheetHeader>
          <SheetTitle>Filter articles</SheetTitle>
          <SheetDescription>
            Narrow the list by topic, reading time, or recency.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-wrap gap-2 p-4">
          {TOPICS.map((t) => (
            <Badge key={t} variant="outline">
              #{t}
            </Badge>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export const Default: Story = {
  args: {
    open: true,
    side: 'right',
    modal: true,
    disablePointerDismissal: false,
  },
  parameters: {
    // The panel and its backdrop are portalled to <body>. Rendered inline on
    // the autodocs page they would cover the whole page, so this story gets
    // its own iframe there. The standalone story view is unaffected.
    docs: { story: { inline: false, height: '520px' } },
  },
  render: (args) => <SheetDemo {...args} />,
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

/** All four anchors, opened one at a time from their own trigger. */
export const Sides: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
        <Sheet key={side}>
          <SheetTrigger render={<Button variant="outline" />}>
            {side}
          </SheetTrigger>
          <SheetContent side={side}>
            <SheetHeader>
              <SheetTitle>side=&quot;{side}&quot;</SheetTitle>
              <SheetDescription>
                Left / right fill 3/4 of the width up to `sm:max-w-96`; top /
                bottom size to their content.
              </SheetDescription>
            </SheetHeader>
          </SheetContent>
        </Sheet>
      ))}
    </div>
  ),
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
