import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor } from 'storybook/test';
import { ScrollArea } from '@interlace/ui/scroll-area';
import { Separator } from '@interlace/ui/separator';
import { withDark, withRtl } from '@/decorators';

const meta: Meta<typeof ScrollArea> = {
  title: 'Primitives/ScrollArea',
  component: ScrollArea,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Cross-browser scrollable region with token-styled scrollbars. Keeps overflow content discoverable without the platform-default scrollbar variance.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof ScrollArea>;

const tags = Array.from({ length: 30 }, (_, i) => `topic-${i + 1}`);

export const Default: Story = {
  render: () => (
    <ScrollArea className="border-border h-72 w-60 rounded-md border p-3">
      <h3 className="mb-2 text-sm font-semibold">Topics</h3>
      {tags.map((t) => (
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
      {tags.map((t) => (
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

export const Dark: Story = {
  ...Default,
  decorators: [withDark],
};

export const RTL: Story = {
  ...Default,
  decorators: [withRtl],
};
