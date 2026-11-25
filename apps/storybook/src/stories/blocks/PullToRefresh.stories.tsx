import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { PullToRefresh } from '@interlace/ui/patterns/pull-to-refresh';
import { withRtl } from '@/decorators';

const ITEMS = ['A new question was answered', 'Two sources were added', 'Your session is confirmed', 'A reply to your note'];

function Feed({ onRefresh }: { onRefresh?: () => void }) {
  const [items, setItems] = React.useState(ITEMS);
  return (
    <PullToRefresh
      onRefresh={async () => {
        onRefresh?.();
        await new Promise((resolve) => setTimeout(resolve, 600));
        setItems((list) => [`Fresh item ${list.length - ITEMS.length + 1}`, ...list]);
      }}
    >
      <ul className="divide-border divide-y">
        {items.map((item) => (
          <li key={item} className="px-4 py-3 text-sm">
            {item}
          </li>
        ))}
      </ul>
    </PullToRefresh>
  );
}

const meta = {
  title: 'Blocks/PullToRefresh',
  component: PullToRefresh,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Pull a list down from its top to load what is new. The pull is damped like a spring, arms at `threshold` (the arrow flips), and the spinner holds until `onRefresh` settles; what happened is said in a live region. The gesture always has a twin: a Refresh button, visible where the pointer is a mouse and reachable by keyboard and screen reader everywhere (WCAG 2.5.1). While pulling, the browser\'s own pull-to-refresh is held back. Under reduced motion nothing moves; the indicator fades in place.',
      },
    },
  },
  args: { onRefresh: fn() },
  render: (args) => (
    <div className="bg-background text-foreground min-h-[20rem] p-2">
      <Feed onRefresh={args.onRefresh as () => void} />
    </div>
  ),
} satisfies Meta<typeof PullToRefresh>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A feed: pull it down on a touch screen, or use the Refresh button. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole('listitem')).toHaveLength(4);
    await expect(canvas.getByRole('button', { name: 'Refresh' })).toBeTruthy();
  },
};

/** The button twin refreshes too, and the new item lands at the top. */
export const RefreshButton: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Refresh' }));
    await expect(args.onRefresh).toHaveBeenCalled();
    await expect(await canvas.findByText('Fresh item 1', undefined, { timeout: 2000 })).toBeTruthy();
  },
};

/** Right to left. */
export const RightToLeft: Story = {
  decorators: [withRtl],
};
