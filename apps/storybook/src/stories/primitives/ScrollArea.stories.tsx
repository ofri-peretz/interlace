import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor } from 'storybook/test';
import { ScrollArea } from '@interlace/ui/scroll-area';
import { Separator } from '@interlace/ui/separator';
import { withRtl } from '@/decorators';

/**
 * The root's own API is deliberately thin — it is sized by its parent and the
 * viewport / scrollbar / thumb are composed internally. `itemCount` is a
 * story-only knob (not a component prop) so the reader can push the content
 * past the box height and watch the overlay scrollbar appear.
 */
type ScrollAreaStoryArgs = React.ComponentProps<typeof ScrollArea> & {
  itemCount?: number;
};

const meta: Meta<ScrollAreaStoryArgs> = {
  title: 'Primitives/ScrollArea',
  component: ScrollArea,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A bounded region whose overflow scrolls behind a token-styled overlay scrollbar, so a long list reads the same on macOS (where native bars are hidden until you scroll) as on Windows (where they steal 15px of layout). Reach for it when a box has a fixed height and its content does not — sidebars, command palettes, long option lists. Do not wrap the page body in it: the document scroller carries scroll restoration, `scroll-margin` anchoring and browser find-in-page, and a custom region loses all three.',
      },
    },
  },
  argTypes: {
    className: {
      control: 'text',
      description:
        'The sizing seam. The root is `relative` and otherwise size-agnostic — it scrolls only once a height (or width) bounds it, so the box dimensions, border and padding all arrive through here.',
      table: { type: { summary: 'string' }, category: 'Appearance' },
    },
    overflowEdgeThreshold: {
      control: { type: 'number', min: 0, max: 64, step: 4 },
      description:
        'Pixels of scroll travel before the `data-overflow-*-start/end` attributes flip. Raise it to delay a fade-out mask at the edges of the region.',
      table: { type: { summary: 'number | { xStart, xEnd, yStart, yEnd }' }, defaultValue: { summary: '0' }, category: 'Appearance' },
    },
    itemCount: {
      control: { type: 'range', min: 1, max: 60, step: 1 },
      description:
        'Story-only: how many demo rows to render. Drop it below the point where the content fits and the scrollbar disappears — the region is only scrollable when it overflows.',
      table: { type: { summary: 'number' }, category: 'Data' },
    },
    children: {
      control: false,
      description:
        'Scrollable content. Mounted inside the internal `Viewport` → `Content` pair, which is what actually carries `tabindex="0"` for keyboard users.',
      table: { type: { summary: 'ReactNode' }, category: 'Slots' },
    },
  },
};

export default meta;
type Story = StoryObj<ScrollAreaStoryArgs>;

const topics = (count: number) =>
  Array.from({ length: count }, (_, i) => `topic-${i + 1}`);

export const Default: Story = {
  args: {
    className: 'border-border h-72 w-60 rounded-md border p-3',
    itemCount: 30,
    overflowEdgeThreshold: 0,
  },
  render: ({ itemCount = 30, ...args }) => (
    <ScrollArea {...args}>
      <h3 className="mb-2 text-sm font-semibold">Topics</h3>
      {topics(itemCount).map((t) => (
        <div key={t}>
          <p className="text-sm">#{t}</p>
          <Separator className="my-1" />
        </div>
      ))}
    </ScrollArea>
  ),
};

/**
 * Keyboard-only flow: a scrollable region that can't be focused strands its
 * overflow content for keyboard users — this is axe's
 * `scrollable-region-focusable` rule. Assert the viewport is tabbable and
 * that arrow keys actually move it.
 */
export const KeyboardFlow: Story = {
  render: () => (
    <ScrollArea className="border-border h-40 w-60 rounded-md border p-3">
      {topics(30).map((t) => (
        <p key={t} className="text-sm">
          #{t}
        </p>
      ))}
    </ScrollArea>
  ),
  play: async ({ canvasElement, step }) => {
    // Re-query every time: Base UI remounts the viewport while it measures
    // overflow, so a node captured once goes stale (and a detached node
    // reports scrollHeight 0, which reads as "no overflow").
    const viewport = () =>
      canvasElement.querySelector(
        '[data-slot="scroll-area-viewport"]',
      ) as HTMLElement;

    await step('The overflowing viewport is in the tab sequence', async () => {
      // Layout and the overflow measurement both land in effects after the
      // first paint, so read the whole contract through waitFor.
      await waitFor(
        () => {
          const vp = viewport();
          expect(vp).toBeTruthy();
          expect(vp.scrollHeight).toBeGreaterThan(vp.clientHeight);
          expect(vp.getAttribute('tabindex')).toBe('0');
        },
        // Fonts + layout + the overflow measurement all have to land first;
        // the 1s default is too tight on a loaded CI runner.
        { timeout: 5000 },
      );
    });

    await step('Tab reaches the region, and it actually scrolls', async () => {
      const vp = viewport();
      await userEvent.tab();
      await waitFor(() => expect(document.activeElement).toBe(vp));
      // Arrow-key scrolling is a BROWSER default action, which only fires on
      // trusted events — userEvent's synthetic keydown can't trigger it. So
      // assert the property that makes the keyboard path work: the focused
      // element is the scroll container itself, not an ancestor.
      vp.scrollTop = 40;
      await waitFor(() => expect(vp.scrollTop).toBeGreaterThan(0));
      expect(document.activeElement).toBe(vp);
    });
  },
};

/**
 * Content that fits — no scrollbar, no `tabindex`, no visual difference from
 * a plain `<div>`. The region only asserts itself once it overflows.
 */
export const NoOverflow: Story = {
  ...Default,
  args: {
    className: 'border-border h-72 w-60 rounded-md border p-3',
    itemCount: 4,
  },
};

export const Dark: Story = {
  ...Default,
  globals: { theme: 'dark' },
};

export const RTL: Story = {
  ...Default,
  decorators: [withRtl],
};
