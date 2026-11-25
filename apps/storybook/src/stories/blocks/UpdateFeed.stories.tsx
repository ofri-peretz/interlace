import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { UpdateFeed } from '@interlace/ui/patterns/update-feed';
import { withRtl } from '@/decorators';

// Neutral sample entries for an invented publication.
const ENTRIES = [
  {
    id: 'tides',
    date: '2026-11-24',
    kind: 'Article',
    title: 'Reading a tide table in five minutes',
    description: 'High water, low water, and why the times move each day.',
    href: '#tides',
  },
  {
    id: 'v2',
    date: '2026-11-24',
    kind: 'Release',
    title: 'Search now covers every chart',
    description: 'Type a harbour name and jump to its chart.',
    href: '#v2',
  },
  {
    id: 'knots',
    date: '2026-11-20',
    kind: 'Guide',
    title: 'Six knots and when to use them',
    href: '#knots',
  },
  {
    id: 'workshop',
    date: '2026-11-12',
    kind: 'Event',
    title: 'Evening workshop: planning a coastal trip',
    description: 'Ninety minutes, online, for beginners.',
    href: '#workshop',
  },
  {
    id: 'autumn',
    date: '2026-10-02',
    kind: 'Notice',
    title: 'Autumn opening hours',
  },
];

const meta = {
  title: 'Blocks/UpdateFeed',
  component: UpdateFeed,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'What is new, newest first, grouped under real `<time>` headings by day or month. Each entry has a kind, a linked title and a line on what it is. ' +
          'Pass `since` (when the reader last looked) and the entries after it are tagged "New" in words, with a one-line count on top. ' +
          'No `since` (a first visit) marks nothing.\n\n' +
          '**Layout.** The date heads its group in a narrow column and moves to a start-side rail once the feed is 42rem wide (a container query).\n\n' +
          '**Routers.** `renderLink` returns your framework link. The model (`patterns/update-feed-model`) sorts, groups and counts new entries for a badge.',
      },
    },
  },
  args: { entries: ENTRIES, locale: 'en-US' },
  argTypes: {
    groupBy: { control: 'inline-radio', options: ['day', 'month'], table: { category: 'Layout' } },
    since: { control: 'text', table: { category: 'State' } },
    headingLevel: { control: 'inline-radio', options: [2, 3], table: { category: 'Content' } },
  },
  render: (args) => (
    <div className="max-w-content">
      <UpdateFeed {...args} />
    </div>
  ),
} satisfies Meta<typeof UpdateFeed>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A returning reader: two entries arrived since the last visit. */
export const Default: Story = {
  args: { since: '2026-11-21' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('2 new since your last visit')).toBeTruthy();
  },
};

/** A first visit: nothing is tagged. */
export const FirstVisit: Story = {};

/** Grouped by month, for a slower feed. */
export const ByMonth: Story = {
  args: { groupBy: 'month' },
};

/** In a narrow column the date heads each group. */
export const Narrow: Story = {
  args: { since: '2026-11-21' },
  render: (args) => (
    <div className="w-[340px] max-w-full">
      <UpdateFeed {...args} />
    </div>
  ),
};

/** Nothing yet. */
export const Empty: Story = {
  args: { entries: [], labels: { empty: 'Nothing new yet. Check back soon.' } },
};

/** Right to left. */
export const RightToLeft: Story = {
  decorators: [withRtl],
  args: { since: '2026-11-21' },
};
